// Package aiscan serves StartAIScan: runs a scan if the AI scan feature is
// live for the caller's site.
package aiscan

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"sort"
	"strings"

	"github.com/lloydwilliams/feature-flags/sample-go-api/internal/flags"
	"github.com/lloydwilliams/feature-flags/sample-go-api/internal/web"
)

// Request is the body of a StartAIScan call.
//
// email and site are the flag evaluation context, the same pair
// getUserProfile takes. Both are required here rather than optional: the flag
// targets on site, and the response names the site back to the caller, so
// there is no sensible behaviour without it.
//
// Amount bounds mirror the validation sample-react applies before it ever
// calls: a whole number below 1000. Checked again here because a client-side
// rule is a convenience, not a guarantee.
type Request struct {
	// Pointer, so a missing amount is told apart from 0.
	Amount *int   `json:"amount"`
	Email  string `json:"email"`
	Site   string `json:"site"`
}

// Response is the result of a StartAIScan call.
//
// Message is the human-readable line for the UI. The other fields carry the
// same facts in structured form, so a caller can branch on enabled without
// matching on message text.
//
// Reason and Variant come straight from the flag evaluation, and are what
// explain a decision rather than just stating it: TARGETING_MATCH means a rule
// named this site, SPLIT means the caller fell into a percentage rollout -
// with variant naming the bucket - and STATIC means neither applied and the
// flag's own value was used.
type Response struct {
	Enabled bool   `json:"enabled"`
	Site    string `json:"site"`
	Amount  int    `json:"amount"`
	Reason  string `json:"reason,omitempty"`
	Variant string `json:"variant,omitempty"`
	Message string `json:"message"`
}

// Handler serves StartAIScan.
type Handler struct {
	Flags   *flags.Flags
	FlagKey string
}

// StartAIScan - POST /api/ai-scan/start.
//
// Whether the scan runs is decided by the show-ai-scan flag evaluated for the
// caller's site, so the same Datadog rule that shows the button in
// sample-react also governs the backend.
//
// A gated-off scan is a 200 with enabled: false, not an error: nothing went
// wrong, the feature is simply not live for that site, and the UI needs the
// message either way. Callers should branch on enabled rather than the status
// code.
func (h Handler) StartAIScan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// A fractional or out-of-range amount fails here as a type error,
		// rather than reaching the bounds check below.
		var typeErr *json.UnmarshalTypeError
		if errors.As(err, &typeErr) && typeErr.Field == "amount" {
			web.Error(w, http.StatusBadRequest, "amount must be a whole number")
			return
		}
		// Malformed or absent JSON, which never reaches validation.
		web.Error(w, http.StatusBadRequest, "Request body is missing or not valid JSON")
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	req.Site = strings.TrimSpace(req.Site)

	if msgs := validate(req); len(msgs) > 0 {
		web.Error(w, http.StatusBadRequest, strings.Join(msgs, "; "))
		return
	}
	amount := *req.Amount

	slog.InfoContext(ctx, "StartAIScan requested", "email", req.Email, "site", req.Site, "amount", amount)

	// Default false, so a provider that cannot be reached leaves the feature
	// off rather than announcing success it cannot back up.
	flag := h.Flags.BooleanDetails(ctx, h.FlagKey, false, req.Email, req.Site)

	// errorCode as well as reason: reason ERROR alone does not say whether the
	// key is missing from the flag configuration or the provider failed, and
	// those need different fixes. variant names the rollout bucket when the
	// reason is SPLIT; for a boolean flag Datadog reports it as "true"/"false".
	slog.DebugContext(ctx, "StartAIScan flag evaluated",
		"flag", h.FlagKey,
		"flagValue", flag.Value,
		"reason", flag.Reason,
		"variant", flag.Variant,
		"errorCode", flag.ErrorCode,
		"site", req.Site,
	)

	resp := Response{
		Enabled: flag.Value,
		Site:    req.Site,
		Amount:  amount,
		Reason:  string(flag.Reason),
		Variant: flag.Variant,
	}
	if flag.Value {
		resp.Message = "AI Scan Successful at site: " + req.Site
		slog.InfoContext(ctx, "StartAIScan completed", "site", req.Site, "amount", amount)
	} else {
		resp.Message = "Sorry this feature is not available at this site yet: " + req.Site
		slog.InfoContext(ctx, "StartAIScan not available", "site", req.Site, "amount", amount)
	}
	web.WriteJSON(w, http.StatusOK, resp)
}

// validate returns every problem with req, sorted, so one response reports
// them all - the same messages sample-java-api returns.
func validate(req Request) []string {
	var msgs []string
	switch {
	case req.Amount == nil:
		msgs = append(msgs, "amount is required")
	case *req.Amount < 0:
		msgs = append(msgs, "amount must be 0 or greater")
	case *req.Amount > 999:
		msgs = append(msgs, "amount must be less than 1000")
	}
	switch {
	case req.Email == "":
		msgs = append(msgs, "email is required")
	case !web.IsEmail(req.Email):
		msgs = append(msgs, "must be a valid email address")
	}
	if req.Site == "" {
		msgs = append(msgs, "site is required")
	}
	sort.Strings(msgs)
	return msgs
}
