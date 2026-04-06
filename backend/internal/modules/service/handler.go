package service

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"wabot-backend/config"
	"wabot-backend/internal/model"
)

func HandleGetStatus(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if !config.AppConfig.IsServiceAllowed(name) {
		model.SendError(w, http.StatusForbidden, "Service '"+name+"' tidak diizinkan")
		return
	}

	status, err := GetStatus(name)
	if err != nil {
		model.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	model.SendSuccess(w, status)
}

func HandleStart(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	output, err := StartService(name)
	if err != nil {
		model.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	model.SendSuccess(w, map[string]string{
		"service": name,
		"action":  "start",
		"result":  output,
	})
}

func HandleStop(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	output, err := StopService(name)
	if err != nil {
		model.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	model.SendSuccess(w, map[string]string{
		"service": name,
		"action":  "stop",
		"result":  output,
	})
}

func HandleRestart(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	output, err := RestartService(name)
	if err != nil {
		model.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	model.SendSuccess(w, map[string]string{
		"service": name,
		"action":  "restart",
		"result":  output,
	})
}
