package middleware

import (
	"net/http"

	"wabot-backend/config"
	"wabot-backend/internal/model"
)

func APIKeyAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		apiKey := r.Header.Get("X-API-Key")

		if apiKey == "" {
			model.SendError(w, http.StatusUnauthorized, "API key diperlukan")
			return
		}

		if apiKey != config.AppConfig.APIKey {
			model.SendError(w, http.StatusForbidden, "API key tidak valid")
			return
		}

		next.ServeHTTP(w, r)
	})
}
