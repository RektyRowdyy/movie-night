package main

import (
	"context"
	"encoding/json"
	"log"
	"os"

	webpush "github.com/SherClockHolmes/webpush-go"
)

type pushSub struct {
	Endpoint string `json:"endpoint"`
	P256dh   string `json:"p256dh"`
	Auth     string `json:"auth"`
}

type pusher struct {
	pub, priv, subject string
}

func newPusher() *pusher {
	return &pusher{
		pub:     os.Getenv("VAPID_PUBLIC_KEY"),
		priv:    os.Getenv("VAPID_PRIVATE_KEY"),
		subject: env("VAPID_SUBJECT", "mailto:admin@movienight.local"),
	}
}

type pushPayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
}

// notifyHost sends a Web Push to every subscription on file for this invite's
// host, dropping any subscription the push service reports as gone (404/410).
func (s *server) notifyHost(ctx context.Context, iv *Invite) {
	if s.push.pub == "" || s.push.priv == "" {
		return // VAPID not configured (e.g. local dev without keys) — skip silently
	}
	subs, err := s.store.subsForHost(ctx, iv.HostToken)
	if err != nil {
		log.Printf("push: load subs: %v", err)
		return
	}
	pickedTitle := ""
	for _, m := range iv.Movies {
		if iv.PickedMovieID != nil && m.ID == *iv.PickedMovieID {
			pickedTitle = m.Title
		}
	}
	body, _ := json.Marshal(pushPayload{
		Title: iv.GuestName + " punched their ticket 🎬",
		Body:  "It's " + pickedTitle + " — the good couch has officially been awarded.",
		URL:   "/host/" + iv.HostToken,
	})
	for _, sub := range subs {
		resp, err := webpush.SendNotification(body, &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys:     webpush.Keys{P256dh: sub.P256dh, Auth: sub.Auth},
		}, &webpush.Options{
			Subscriber:      s.push.subject,
			VAPIDPublicKey:  s.push.pub,
			VAPIDPrivateKey: s.push.priv,
			TTL:             60,
		})
		if err != nil {
			log.Printf("push: send: %v", err)
			continue
		}
		resp.Body.Close()
		if resp.StatusCode == 404 || resp.StatusCode == 410 {
			s.store.deleteSub(ctx, sub.Endpoint)
		}
	}
}
