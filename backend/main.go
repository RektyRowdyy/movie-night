package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
)

type server struct {
	store *Store
	push  *pusher
}

func main() {
	ctx := context.Background()
	store, err := openStore(ctx)
	if err != nil {
		log.Fatalf("db: %v", err)
	}

	// subcommand: `movienight seed`
	if len(os.Args) > 1 && os.Args[1] == "seed" {
		if err := seed(ctx, store); err != nil {
			log.Fatalf("seed: %v", err)
		}
		return
	}

	srv := &server{store: store, push: newPusher()}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/config", srv.config)
	mux.HandleFunc("POST /api/invite", srv.createInvite)
	mux.HandleFunc("GET /api/invite/{token}", srv.getInvite)
	mux.HandleFunc("POST /api/invite/{token}/pick", srv.pick)
	mux.HandleFunc("GET /api/host/{token}", srv.getHost)
	mux.HandleFunc("POST /api/host/{token}/push", srv.subscribe)

	addr := ":" + env("PORT", "8080")
	log.Printf("movie-night backend on %s", addr)
	log.Fatal(http.ListenAndServe(addr, cors(mux)))
}

// cors allows the Vite dev server (different origin) to call the API.
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", env("CORS_ORIGIN", "*"))
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}
