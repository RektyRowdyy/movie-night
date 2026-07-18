package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// TestPickStateMachine drives the State Matrix (Technical Requirements §5):
// waiting -> answered -> re-pick -> locked -> expired, plus the 409 guards.
func TestPickStateMachine(t *testing.T) {
	ctx := context.Background()
	store, err := openStore(ctx)
	if err != nil {
		t.Fatalf("openStore: %v (is `docker compose up -d db` running?)", err)
	}
	srv := &server{store: store, push: newPusher()}

	movies := []Movie{{ID: "m1", Title: "A"}, {ID: "m2", Title: "B"}, {ID: "m3", Title: "C"}}
	iv := &Invite{
		InviteToken: token(), HostToken: token(),
		HostName: "Maya", GuestName: "Sam", Note: "n", Location: "l",
		EventAt: time.Now().Add(time.Hour), ExpiresAt: time.Now().Add(2 * time.Hour),
		Movies: movies,
	}
	if err := store.insert(ctx, iv); err != nil {
		t.Fatalf("insert: %v", err)
	}

	doPick := func(movieID string) int {
		body := strings.NewReader(`{"movieId":"` + movieID + `"}`)
		req := httptest.NewRequest("POST", "/api/invite/"+iv.InviteToken+"/pick", body)
		req.SetPathValue("token", iv.InviteToken)
		w := httptest.NewRecorder()
		srv.pick(w, req)
		return w.Code
	}

	// waiting -> answered
	if code := doPick("m1"); code != http.StatusOK {
		t.Fatalf("first pick: want 200, got %d", code)
	}
	got, _ := store.byInviteToken(ctx, iv.InviteToken)
	if got.Status != "answered" || got.PickedMovieID == nil || *got.PickedMovieID != "m1" {
		t.Fatalf("after first pick: status=%s picked=%v", got.Status, got.PickedMovieID)
	}
	if got.SwapsUsed != 0 || !got.CanRepick() {
		t.Fatalf("after first pick: expected swaps=0, canRepick=true; got swaps=%d canRepick=%v", got.SwapsUsed, got.CanRepick())
	}

	// re-pick (the one allowed swap)
	if code := doPick("m2"); code != http.StatusOK {
		t.Fatalf("re-pick: want 200, got %d", code)
	}
	got, _ = store.byInviteToken(ctx, iv.InviteToken)
	if got.SwapsUsed != 1 || got.PickedMovieID == nil || *got.PickedMovieID != "m2" {
		t.Fatalf("after re-pick: swaps=%d picked=%v", got.SwapsUsed, got.PickedMovieID)
	}
	if got.CanRepick() {
		t.Fatalf("after re-pick: expected locked (canRepick=false)")
	}

	// second re-pick attempt must be rejected
	if code := doPick("m3"); code != http.StatusConflict {
		t.Fatalf("second re-pick: want 409, got %d", code)
	}
	got, _ = store.byInviteToken(ctx, iv.InviteToken)
	if got.PickedMovieID == nil || *got.PickedMovieID != "m2" {
		t.Fatalf("pick must not change after locked swap: got %v", got.PickedMovieID)
	}

	// expired invite rejects any pick
	expIv := &Invite{
		InviteToken: token(), HostToken: token(),
		HostName: "Maya", GuestName: "Sam", Note: "n", Location: "l",
		EventAt: time.Now().Add(-2 * time.Hour), ExpiresAt: time.Now().Add(-time.Hour),
		Movies: movies,
	}
	if err := store.insert(ctx, expIv); err != nil {
		t.Fatalf("insert expired: %v", err)
	}
	body := strings.NewReader(`{"movieId":"m1"}`)
	req := httptest.NewRequest("POST", "/api/invite/"+expIv.InviteToken+"/pick", body)
	req.SetPathValue("token", expIv.InviteToken)
	w := httptest.NewRecorder()
	srv.pick(w, req)
	if w.Code != http.StatusConflict {
		t.Fatalf("expired pick: want 409, got %d", w.Code)
	}
}
