package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

func (s *server) config(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"vapidPublicKey": s.push.pub})
}

type createInviteReq struct {
	HostName  string    `json:"hostName"`
	GuestName string    `json:"guestName"`
	Note      string    `json:"note"`
	Location  string    `json:"location"`
	EventAt   time.Time `json:"eventAt"`
	Movies    []Movie   `json:"movies"`
}

func (s *server) createInvite(w http.ResponseWriter, r *http.Request) {
	var req createInviteReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	if len(req.Movies) != 3 {
		writeErr(w, http.StatusBadRequest, "exactly 3 movies required")
		return
	}
	for i := range req.Movies {
		if req.Movies[i].ID == "" {
			req.Movies[i].ID = token()
		}
	}
	iv := &Invite{
		InviteToken: token(),
		HostToken:   token(),
		HostName:    req.HostName,
		GuestName:   req.GuestName,
		Note:        req.Note,
		Location:    req.Location,
		EventAt:     req.EventAt,
		ExpiresAt:   req.EventAt.Add(graceWindow()),
		Movies:      req.Movies,
	}
	if err := s.store.insert(r.Context(), iv); err != nil {
		writeErr(w, http.StatusInternalServerError, "could not create invite")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{
		"inviteToken": iv.InviteToken,
		"hostToken":   iv.HostToken,
	})
}

func (s *server) getInvite(w http.ResponseWriter, r *http.Request) {
	tok := r.PathValue("token")
	iv, err := s.store.byInviteToken(r.Context(), tok)
	if errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "invite not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "lookup failed")
		return
	}
	s.store.markOpened(r.Context(), tok)
	writeJSON(w, http.StatusOK, guestView{Invite: iv, Expired: iv.Expired(), CanRepick: iv.CanRepick()})
}

type pickReq struct {
	MovieID string `json:"movieId"`
}

// pick is the single gate for commit + re-pick, shared by every caller so the
// swap/expiry rule can't be bypassed by hitting the endpoint from elsewhere.
func (s *server) pick(w http.ResponseWriter, r *http.Request) {
	tok := r.PathValue("token")
	var req pickReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	iv, err := s.store.byInviteToken(r.Context(), tok)
	if errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "invite not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "lookup failed")
		return
	}
	if iv.Expired() {
		writeErr(w, http.StatusConflict, "invite expired")
		return
	}
	found := false
	for _, m := range iv.Movies {
		if m.ID == req.MovieID {
			found = true
		}
	}
	if !found {
		writeErr(w, http.StatusBadRequest, "unknown movie")
		return
	}

	newSwaps := iv.SwapsUsed
	if iv.Status == "answered" {
		if iv.PickedMovieID != nil && *iv.PickedMovieID == req.MovieID {
			// re-committing the same pick is a no-op, not a swap
		} else if iv.SwapsUsed >= 1 {
			writeErr(w, http.StatusConflict, "re-pick already used")
			return
		} else {
			newSwaps = 1
		}
	}

	updated, err := s.store.applyPick(r.Context(), tok, req.MovieID, newSwaps)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not save pick")
		return
	}
	s.notifyHost(r.Context(), updated)
	writeJSON(w, http.StatusOK, guestView{Invite: updated, Expired: updated.Expired(), CanRepick: updated.CanRepick()})
}
