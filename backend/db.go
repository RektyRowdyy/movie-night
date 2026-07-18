package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var errNotFound = errors.New("not found")

type Store struct{ pool *pgxpool.Pool }

func openStore(ctx context.Context) (*Store, error) {
	dsn := env("DATABASE_URL", "postgres://movienight:movienight@localhost:5432/movienight")
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, err
	}
	// migrations are idempotent (IF NOT EXISTS) — safe to run on every boot.
	sql, err := os.ReadFile("migrations/001_init.sql")
	if err != nil {
		return nil, err
	}
	if _, err := pool.Exec(ctx, string(sql)); err != nil {
		return nil, err
	}
	return &Store{pool}, nil
}

const inviteCols = `invite_token, host_token, host_name, guest_name, note, location, location_label, bring,
	event_at, expires_at, created_at, movies, status, picked_movie_id,
	answered_at, swaps_used, opened_at`

func scanInvite(row pgx.Row) (*Invite, error) {
	var iv Invite
	var moviesJSON []byte
	err := row.Scan(&iv.InviteToken, &iv.HostToken, &iv.HostName, &iv.GuestName,
		&iv.Note, &iv.Location, &iv.LocationLabel, &iv.Bring, &iv.EventAt, &iv.ExpiresAt, &iv.CreatedAt,
		&moviesJSON, &iv.Status, &iv.PickedMovieID, &iv.AnsweredAt,
		&iv.SwapsUsed, &iv.OpenedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(moviesJSON, &iv.Movies); err != nil {
		return nil, err
	}
	return &iv, nil
}

func (s *Store) byInviteToken(ctx context.Context, tok string) (*Invite, error) {
	return scanInvite(s.pool.QueryRow(ctx,
		`SELECT `+inviteCols+` FROM invites WHERE invite_token=$1`, tok))
}

func (s *Store) byHostToken(ctx context.Context, tok string) (*Invite, error) {
	return scanInvite(s.pool.QueryRow(ctx,
		`SELECT `+inviteCols+` FROM invites WHERE host_token=$1`, tok))
}

func (s *Store) insert(ctx context.Context, iv *Invite) error {
	movies, err := json.Marshal(iv.Movies)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx,
		`INSERT INTO invites (invite_token, host_token, host_name, guest_name, note,
		 location, location_label, bring, event_at, expires_at, movies) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		iv.InviteToken, iv.HostToken, iv.HostName, iv.GuestName, iv.Note,
		iv.Location, iv.LocationLabel, iv.Bring, iv.EventAt, iv.ExpiresAt, movies)
	return err
}

// markOpened sets opened_at only on first guest open ("opened, not answered" host copy).
func (s *Store) markOpened(ctx context.Context, tok string) {
	_, _ = s.pool.Exec(ctx,
		`UPDATE invites SET opened_at=now() WHERE invite_token=$1 AND opened_at IS NULL`, tok)
}

// applyPick records a commit/re-pick. Returns the updated invite.
func (s *Store) applyPick(ctx context.Context, tok, movieID string, swaps int) (*Invite, error) {
	return scanInvite(s.pool.QueryRow(ctx,
		`UPDATE invites SET status='answered', picked_movie_id=$2, answered_at=now(),
		 swaps_used=$3 WHERE invite_token=$1 RETURNING `+inviteCols, tok, movieID, swaps))
}

func (s *Store) saveSub(ctx context.Context, hostTok, endpoint, p256dh, auth string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO push_subs (host_token, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)
		 ON CONFLICT (host_token, endpoint) DO UPDATE SET p256dh=$3, auth=$4`,
		hostTok, endpoint, p256dh, auth)
	return err
}

func (s *Store) subsForHost(ctx context.Context, hostTok string) ([]pushSub, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT endpoint, p256dh, auth FROM push_subs WHERE host_token=$1`, hostTok)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []pushSub
	for rows.Next() {
		var p pushSub
		if err := rows.Scan(&p.Endpoint, &p.P256dh, &p.Auth); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) deleteSub(ctx context.Context, endpoint string) {
	_, _ = s.pool.Exec(ctx, `DELETE FROM push_subs WHERE endpoint=$1`, endpoint)
}

func (s *Store) hasSub(ctx context.Context, hostTok string) bool {
	var n int
	_ = s.pool.QueryRow(ctx,
		`SELECT count(*) FROM push_subs WHERE host_token=$1`, hostTok).Scan(&n)
	return n > 0
}

// token returns a URL-safe opaque secret (~128 bits).
func token() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func graceWindow() time.Duration {
	if d, err := time.ParseDuration(env("EXPIRY_GRACE", "4h")); err == nil {
		return d
	}
	return 4 * time.Hour
}
