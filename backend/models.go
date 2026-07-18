package main

import "time"

// Movie is the per-invite embedded movie card. Stored as JSONB, mirrors the
// design's sample data verbatim (posterBg/posterFg carry the gradient treatment).
type Movie struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Year     string   `json:"year"`
	Runtime  string   `json:"runtime"`
	Genre    string   `json:"genre"`
	MoodTag  string   `json:"moodTag"`
	Rating   string   `json:"rating"`
	Director string   `json:"director"`
	Hook     string   `json:"hook"`
	Synopsis string   `json:"synopsis"`
	Tags     []string `json:"tags"`
	TrailerQ string   `json:"trailerq"`
	PosterBg string   `json:"posterBg"`
	PosterFg string   `json:"posterFg"`
}

// Invite is the full row. Guest responses omit HostToken (see guestView).
type Invite struct {
	InviteToken   string     `json:"inviteToken"`
	HostToken     string     `json:"-"`
	HostName      string     `json:"hostName"`
	GuestName     string     `json:"guestName"`
	Note          string     `json:"note"`
	Location      string     `json:"location"`
	LocationLabel string     `json:"locationLabel"`
	Bring         string     `json:"bring"`
	EventAt       time.Time  `json:"eventAt"`
	ExpiresAt     time.Time  `json:"expiresAt"`
	CreatedAt     time.Time  `json:"createdAt"`
	Movies        []Movie    `json:"movies"`
	Status        string     `json:"status"`
	PickedMovieID *string    `json:"pickedMovieId"`
	AnsweredAt    *time.Time `json:"answeredAt"`
	SwapsUsed     int        `json:"swapsUsed"`
	OpenedAt      *time.Time `json:"openedAt"`
}

// derived flags shared by both views
func (i *Invite) Expired() bool { return time.Now().After(i.ExpiresAt) }
func (i *Invite) CanRepick() bool {
	return i.Status == "answered" && i.SwapsUsed < 1 && !i.Expired()
}

// guestView is what a guest link returns — never leaks the host secret.
type guestView struct {
	*Invite
	Expired   bool `json:"expired"`
	CanRepick bool `json:"canRepick"`
}

// hostView adds host-only fields (expired flag, whether push is registered).
type hostView struct {
	*Invite
	HostToken   string `json:"hostToken"`
	Expired     bool   `json:"expired"`
	PushEnabled bool   `json:"pushEnabled"`
}
