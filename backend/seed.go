package main

import (
	"context"
	"fmt"
	"time"
)

// seed inserts one sample invite using the design's exact movie data and
// prints the guest + host links — the v1 stand-in for a host authoring UI.
func seed(ctx context.Context, store *Store) error {
	eventAt := time.Now().Add(48 * time.Hour).Truncate(time.Hour)
	iv := &Invite{
		InviteToken: token(),
		HostToken:   token(),
		HostName:    "Maya",
		GuestName:   "Sam",
		Note: "Sam — I've been threatening a movie night for weeks and here it is. " +
			"Pizza's handled. I got it to three and stalled, so the last call is yours. " +
			"Winner gets the good couch.",
		Location:  "https://discord.gg/movie-night-voice",
		EventAt:   eventAt,
		ExpiresAt: eventAt.Add(graceWindow()),
		Movies: []Movie{
			{
				ID: token(), Title: "The Odyssey", Year: "2026", Runtime: "2h 58m", Genre: "Epic Adventure",
				MoodTag: "EPIC · SEAFARING", Rating: "8.4", Director: "Réka Marlow",
				Hook:     "Ten years lost at sea. One way home.",
				Tags:     []string{"Epic", "Adventure", "Drama"},
				TrailerQ: "the+odyssey",
				Synopsis: "A soldier-king survives the war only to face a far longer battle: the sea " +
					"between him and everyone he loves. Gods bargain over his fate while, an ocean away, " +
					"a wife holds a kingdom together with nothing but patience and cunning. An old story " +
					"told at full scale — storms, monsters, and the ache of almost-home.",
				PosterBg: "linear-gradient(158deg,#12333c,#0a1d23)", PosterFg: "#e9c15f",
			},
			{
				ID: token(), Title: "Obsession", Year: "2025", Runtime: "1h 47m", Genre: "Thriller",
				MoodTag: "TENSE · PARANOID", Rating: "7.1", Director: "Nadia Okonkwo",
				Hook:     "She noticed him first. That was the mistake.",
				Tags:     []string{"Thriller", "Mystery", "Slow-burn"},
				TrailerQ: "obsession+thriller",
				Synopsis: "A night-shift translator becomes convinced the man in the window opposite is " +
					"watching her. The harder she looks, the less she trusts her own account of the night. " +
					"A tight, paranoid two-hander that keeps quietly moving the line between the watcher " +
					"and the watched.",
				PosterBg: "linear-gradient(158deg,#3a1414,#180909)", PosterFg: "#ecdccb",
			},
			{
				ID: token(), Title: "Sheep Detectives", Year: "2026", Runtime: "1h 32m", Genre: "Comedy",
				MoodTag: "ODDBALL · DEADPAN", Rating: "7.6", Director: "Bram Fettle",
				Hook:     "Ewe won't believe who did it.",
				Tags:     []string{"Comedy", "Mystery", "Stop-motion"},
				TrailerQ: "sheep+detectives",
				Synopsis: "When the prize ram vanishes the night before the county fair, two spectacularly " +
					"unqualified sheep appoint themselves to the case. Handmade, deadpan, and far cleverer " +
					"than it has any right to be — the kind of small film that wins a room over by the " +
					"second scene.",
				PosterBg: "linear-gradient(158deg,#e7c24d,#c39f2f)", PosterFg: "#2a1c07",
			},
		},
	}
	if err := store.insert(ctx, iv); err != nil {
		return err
	}
	base := env("APP_BASE_URL", "http://localhost:5173")
	fmt.Printf("Guest link: %s/i/%s\n", base, iv.InviteToken)
	fmt.Printf("Host link:  %s/host/%s\n", base, iv.HostToken)
	return nil
}
