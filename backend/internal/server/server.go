package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"wabot-backend/config"
	"wabot-backend/internal/middleware"
	"wabot-backend/internal/modules/apache"
	"wabot-backend/internal/modules/audit"
	"wabot-backend/internal/modules/automation"
	"wabot-backend/internal/modules/logs"
	"wabot-backend/internal/modules/monitoring"
	"wabot-backend/internal/modules/process"
	"wabot-backend/internal/modules/service"
	"wabot-backend/internal/modules/tools"
)

func NewRouter() *chi.Mux {
	r := chi.NewRouter()

	r.Use(middleware.Logger)

	rateLimiter := middleware.NewRateLimiter(config.AppConfig.Security.RateLimitPerMinute)
	r.Use(rateLimiter.Middleware)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","version":"2.0.0"}`))
	})

	r.Group(func(r chi.Router) {
		r.Use(middleware.APIKeyAuth)

		r.Route("/api", func(r chi.Router) {
			r.Route("/monitoring", func(r chi.Router) {
				r.Get("/status", monitoring.HandleStatus)
				r.Get("/services", monitoring.HandleServices)
				r.Get("/baseline", monitoring.HandleBaseline)
				r.Get("/anomalies", monitoring.HandleAnomalies)
				r.Get("/trends", monitoring.HandleTrends)
				r.Get("/history", monitoring.HandleHistory)
				r.Post("/baseline/reset", monitoring.HandleBaselineReset)
				r.Get("/network", monitoring.HandleNetworkStats)
			})

			r.Route("/service/{name}", func(r chi.Router) {
				r.Get("/", service.HandleGetStatus)
				r.Post("/start", service.HandleStart)
				r.Post("/stop", service.HandleStop)
				r.Post("/restart", service.HandleRestart)
			})

			r.Route("/apache", func(r chi.Router) {
				r.Get("/status", apache.HandleStatus)
				r.Post("/restart", apache.HandleRestart)
				r.Post("/reload", apache.HandleReload)
				r.Get("/configtest", apache.HandleConfigTest)
				r.Get("/vhost", apache.HandleVHosts)
			})

			r.Post("/process/kill/{pid}", process.HandleKill)

			r.Route("/logs", func(r chi.Router) {
				r.Get("/apache", logs.HandleApacheLogs)
				r.Get("/{service}", logs.HandleServiceLogs)
			})

			r.Route("/tools", func(r chi.Router) {
				r.Get("/list", tools.HandleList)
				r.Get("/exec/{name}", tools.HandleExec)
			})

			r.Route("/automation", func(r chi.Router) {
				r.Get("/rules", automation.HandleGetRules)
				r.Put("/rules/{id}", automation.HandleUpdateRule)
				r.Get("/history", automation.HandleGetHistory)
				r.Post("/evaluate", automation.HandleEvaluate)
			})

			r.Route("/audit", func(r chi.Router) {
				r.Post("/log", audit.HandleLog)
				r.Get("/logs", audit.HandleQuery)
			})
		})
	})

	return r
}
