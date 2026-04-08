package monitoring

import (
	"net/http"

	"wabot-backend/internal/model"
)

func HandleStatus(w http.ResponseWriter, r *http.Request) {
	status, err := GetSystemStatus()
	if err != nil {
		model.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	model.SendSuccess(w, status)
}

func HandleServices(w http.ResponseWriter, r *http.Request) {
	services, err := GetServicesStatus()
	if err != nil {
		model.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	model.SendSuccess(w, services)
}

func HandleNetworkStats(w http.ResponseWriter, r *http.Request) {
	stats := GetNetworkStats()
	model.SendSuccess(w, stats)
}
