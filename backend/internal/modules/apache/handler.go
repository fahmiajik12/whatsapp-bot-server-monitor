package apache

import (
	"net/http"

	"wabot-backend/internal/model"
)

func HandleStatus(w http.ResponseWriter, r *http.Request) {
	status, err := GetStatus()
	if err != nil {
		model.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	model.SendSuccess(w, status)
}

func HandleRestart(w http.ResponseWriter, r *http.Request) {
	output, err := Restart()
	if err != nil {
		model.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	model.SendSuccess(w, map[string]string{
		"action": "restart",
		"result": output,
	})
}

func HandleReload(w http.ResponseWriter, r *http.Request) {
	output, err := Reload()
	if err != nil {
		model.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	model.SendSuccess(w, map[string]string{
		"action": "reload",
		"result": output,
	})
}

func HandleConfigTest(w http.ResponseWriter, r *http.Request) {
	output, err := ConfigTest()
	if err != nil {
		model.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	model.SendSuccess(w, map[string]string{
		"action": "configtest",
		"result": output,
	})
}

func HandleVHosts(w http.ResponseWriter, r *http.Request) {
	output, err := GetVHosts()
	if err != nil {
		model.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	model.SendSuccess(w, map[string]string{
		"vhosts": output,
	})
}
