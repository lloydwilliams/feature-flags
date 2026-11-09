// Package web holds the HTTP plumbing shared by the API's handlers: the JSON
// error shape, request validation helpers, and CORS.
package web

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/mail"
	"slices"
	"strconv"
)

// WriteJSON writes v as a JSON response body with the given status.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Warn("writing response failed", "error", err)
	}
}

// Error writes the API's error shape, the same one sample-java-api returns:
// {"status":..., "error":..., "message":...}.
func Error(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]any{
		"status":  status,
		"error":   http.StatusText(status),
		"message": message,
	})
}

// IsEmail reports whether s is a bare email address. Display-name forms like
// "Jane <jane@example.com>" are rejected: the address is used as an identity,
// so it has to be exactly the address.
func IsEmail(s string) bool {
	addr, err := mail.ParseAddress(s)
	return err == nil && addr.Name == "" && addr.Address == s
}

// CORS allows the listed browser origins to call /api routes. Preflight
// requests are answered here and never reach the handlers.
func CORS(allowedOrigins []string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && slices.Contains(allowedOrigins, origin) {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Add("Vary", "Origin")
			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				// Echoed rather than "*", which browsers ignore for some headers
				// (and which covers the RUM tracing headers sample-react adds).
				if reqHeaders := r.Header.Get("Access-Control-Request-Headers"); reqHeaders != "" {
					h.Set("Access-Control-Allow-Headers", reqHeaders)
				}
				h.Set("Access-Control-Max-Age", strconv.Itoa(3600))
				w.WriteHeader(http.StatusOK)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
