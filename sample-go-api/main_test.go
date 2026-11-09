package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/lloydwilliams/feature-flags/sample-go-api/internal/flags"
)

// No provider is registered here, so OpenFeature's no-op provider answers
// every evaluation with the call-site default - the same fallback the app
// runs on without DD_API_KEY.
func testServer(t *testing.T, mutate ...func(*config)) *httptest.Server {
	t.Helper()
	cfg := loadConfig()
	cfg.AllowedOrigins = []string{"http://localhost:5174"}
	for _, m := range mutate {
		m(&cfg)
	}
	srv := httptest.NewServer(newHandler(cfg, flags.New()))
	t.Cleanup(srv.Close)
	return srv
}

func decode(t *testing.T, res *http.Response) map[string]any {
	t.Helper()
	defer res.Body.Close()
	var body map[string]any
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("decoding body: %v", err)
	}
	return body
}

func TestGetUserProfile(t *testing.T) {
	srv := testServer(t)

	tests := []struct {
		name       string
		query      string
		wantStatus int
		check      func(t *testing.T, body map[string]any)
	}{
		{
			name: "directory entry, case-insensitive and trimmed", query: "?email=%20JANE@example.com%20&site=Toronto",
			wantStatus: 200,
			check: func(t *testing.T, body map[string]any) {
				if body["displayName"] != "Jane Doe" || body["id"] != "28ea71b5-164b-4eb6-aef4-f4f793d4f086" {
					t.Errorf("got %v", body)
				}
				if acct := body["account"].(map[string]any); acct["id"] != "acct-2002" {
					t.Errorf("account = %v", acct)
				}
			},
		},
		{
			name: "derived profile matches sample-java-api", query: "?email=ada.lovelace@acme.io",
			wantStatus: 200,
			check: func(t *testing.T, body map[string]any) {
				// Java's UUID.nameUUIDFromBytes("ada.lovelace@acme.io")
				if body["id"] != "e528cd81-4c6a-33d3-90e1-2e792411e358" {
					t.Errorf("id = %v", body["id"])
				}
				if body["displayName"] != "Ada Lovelace" {
					t.Errorf("displayName = %v", body["displayName"])
				}
				if acct := body["account"].(map[string]any); acct["id"] != "acct-acme-io" || acct["name"] != "Acme" {
					t.Errorf("account = %v", acct)
				}
			},
		},
		{name: "missing email", query: "", wantStatus: 400},
		{name: "invalid email", query: "?email=not-an-email", wantStatus: 400},
		{name: "error hook", query: "?email=ERROR@example.com", wantStatus: 500},
		{name: "warning hook", query: "?email=warning.me@example.com", wantStatus: 422},
		{name: "error must be a prefix", query: "?email=terror.fan@example.com", wantStatus: 200},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := http.Get(srv.URL + "/api/users/profile" + tt.query)
			if err != nil {
				t.Fatal(err)
			}
			if res.StatusCode != tt.wantStatus {
				t.Fatalf("status = %d, want %d", res.StatusCode, tt.wantStatus)
			}
			body := decode(t, res)
			if tt.wantStatus != 200 && body["status"] != float64(tt.wantStatus) {
				t.Errorf("error body = %v", body)
			}
			if tt.check != nil {
				tt.check(t, body)
			}
		})
	}
}

func TestStrictDirectory(t *testing.T) {
	srv := testServer(t, func(c *config) { c.StrictDirectory = true })
	res, err := http.Get(srv.URL + "/api/users/profile?email=nobody@acme.io")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 404 {
		t.Errorf("status = %d, want 404", res.StatusCode)
	}
}

func TestStartAIScan(t *testing.T) {
	srv := testServer(t)

	post := func(body string) *http.Response {
		t.Helper()
		res, err := http.Post(srv.URL+"/api/ai-scan/start", "application/json", strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		return res
	}

	t.Run("gated off without a provider", func(t *testing.T) {
		res := post(`{"amount": 42, "email": "jane@example.com", "site": "Toronto"}`)
		if res.StatusCode != 200 {
			t.Fatalf("status = %d", res.StatusCode)
		}
		body := decode(t, res)
		if body["enabled"] != false ||
			body["message"] != "Sorry this feature is not available at this site yet: Toronto" {
			t.Errorf("got %v", body)
		}
	})

	invalid := map[string]string{
		"missing amount":    `{"email": "jane@example.com", "site": "Toronto"}`,
		"amount too large":  `{"amount": 1000, "email": "jane@example.com", "site": "Toronto"}`,
		"negative amount":   `{"amount": -1, "email": "jane@example.com", "site": "Toronto"}`,
		"fractional amount": `{"amount": 4.5, "email": "jane@example.com", "site": "Toronto"}`,
		"missing site":      `{"amount": 42, "email": "jane@example.com"}`,
		"bad email":         `{"amount": 42, "email": "jane", "site": "Toronto"}`,
		"not json":          `amount=42`,
	}
	for name, body := range invalid {
		t.Run(name, func(t *testing.T) {
			res := post(body)
			if res.StatusCode != 400 {
				t.Errorf("status = %d, want 400", res.StatusCode)
			}
			res.Body.Close()
		})
	}

	t.Run("all problems reported together", func(t *testing.T) {
		body := decode(t, post(`{}`))
		want := "amount is required; email is required; site is required"
		if body["message"] != want {
			t.Errorf("message = %q, want %q", body["message"], want)
		}
	})
}

func TestCORSPreflight(t *testing.T) {
	srv := testServer(t)
	req, _ := http.NewRequest(http.MethodOptions, srv.URL+"/api/ai-scan/start", nil)
	req.Header.Set("Origin", "http://localhost:5174")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "content-type,traceparent")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if got := res.Header.Get("Access-Control-Allow-Origin"); got != "http://localhost:5174" {
		t.Errorf("Allow-Origin = %q", got)
	}
	if got := res.Header.Get("Access-Control-Allow-Headers"); got != "content-type,traceparent" {
		t.Errorf("Allow-Headers = %q", got)
	}
}
