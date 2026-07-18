package main

import (
	"encoding/json"
	"errors"
	"net/http"
)

func (s *server) getHost(w http.ResponseWriter, r *http.Request) {
	tok := r.PathValue("token")
	iv, err := s.store.byHostToken(r.Context(), tok)
	if errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "invite not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "lookup failed")
		return
	}
	writeJSON(w, http.StatusOK, hostView{
		Invite:      iv,
		HostToken:   iv.HostToken,
		Expired:     iv.Expired(),
		PushEnabled: s.store.hasSub(r.Context(), iv.HostToken),
	})
}

func (s *server) subscribe(w http.ResponseWriter, r *http.Request) {
	tok := r.PathValue("token")
	if _, err := s.store.byHostToken(r.Context(), tok); errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "invite not found")
		return
	}
	var sub pushSub
	if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	if err := s.store.saveSub(r.Context(), tok, sub.Endpoint, sub.P256dh, sub.Auth); err != nil {
		writeErr(w, http.StatusInternalServerError, "could not save subscription")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
