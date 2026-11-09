package userprofile

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/lloydwilliams/feature-flags/sample-go-api/internal/flags"
	"github.com/lloydwilliams/feature-flags/sample-go-api/internal/web"
)

// Handler serves getUserProfile.
type Handler struct {
	Service        Service
	Flags          *flags.Flags
	ReadoutFlagKey string
}

// GetUserProfile returns the profile for the given email address.
//
// GET /api/users/profile?email=jane@example.com&site=Toronto
//
// site is the value chosen in the sample-react drop-down. It does not affect
// the profile returned - it is passed only so server-side flag rules can
// target on it, the same attribute the browser provider sends. Optional, so
// existing callers and plain curl still work; a rule matching on site simply
// will not match when it is absent.
func (h Handler) GetUserProfile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	// Trimmed so " jane@example.com " passes email validation.
	email := strings.TrimSpace(q.Get("email"))
	site := strings.TrimSpace(q.Get("site"))

	if !q.Has("email") {
		web.Error(w, http.StatusBadRequest, "Missing required parameter 'email'")
		return
	}
	if !web.IsEmail(email) {
		web.Error(w, http.StatusBadRequest, "must be a valid email address")
		return
	}

	slog.InfoContext(ctx, "getUserProfile requested", "email", email, "site", site)

	profile, err := h.Service.GetUserProfile(email)
	switch {
	case errors.Is(err, ErrSimulatedError):
		// Logged with the error as an ERROR, as a real failure would be.
		slog.ErrorContext(ctx, "getUserProfile failed", "error", err)
		web.Error(w, http.StatusInternalServerError, err.Error())
		return
	case errors.Is(err, ErrSimulatedWarning):
		// A warning is an expected, handled outcome rather than a fault.
		slog.WarnContext(ctx, "getUserProfile rejected", "error", err)
		web.Error(w, http.StatusUnprocessableEntity, err.Error())
		return
	case errors.Is(err, ErrNotFound):
		web.Error(w, http.StatusNotFound, err.Error())
		return
	case err != nil:
		slog.ErrorContext(ctx, "getUserProfile failed", "error", err)
		web.Error(w, http.StatusInternalServerError, "Profile lookup failed")
		return
	}

	// Server-side flag readout, the counterpart to sample-react's on-screen
	// one: reason is what tells a flag that is off apart from one that does
	// not exist or could not be fetched. Nothing is gated on it yet.
	flag := h.Flags.BooleanDetails(ctx, h.ReadoutFlagKey, false, email, site)

	// What was actually resolved, at DEBUG so the INFO line above stays the
	// one-per-request summary.
	slog.DebugContext(ctx, "getUserProfile resolved",
		"email", email,
		"site", site,
		"displayName", profile.DisplayName,
		"account", profile.Account.ID,
		"plan", profile.Account.Plan,
		"roles", profile.Roles,
		"flag", h.ReadoutFlagKey,
		"flagValue", flag.Value,
		"reason", flag.Reason,
		"variant", flag.Variant,
		"errorCode", flag.ErrorCode,
	)

	web.WriteJSON(w, http.StatusOK, profile)
}
