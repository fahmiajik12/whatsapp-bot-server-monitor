package audit

import (
	"encoding/json"
	"net/http"
	"strconv"

	"wabot-backend/internal/model"
)

func HandleLog(w http.ResponseWriter, r *http.Request) {
	var entry model.AuditEntry
	if err := json.NewDecoder(r.Body).Decode(&entry); err != nil {
		model.SendError(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}

	svc := GetService()
	if err := svc.Log(entry); err != nil {
		model.SendError(w, http.StatusInternalServerError, "Gagal menyimpan audit log")
		return
	}

	model.SendSuccess(w, map[string]string{"message": "OK"})
}

func HandleQuery(w http.ResponseWriter, r *http.Request) {
	countStr := r.URL.Query().Get("count")
	count := 20
	if countStr != "" {
		if n, err := strconv.Atoi(countStr); err == nil && n > 0 {
			count = n
		}
	}

	if count > 100 {
		count = 100
	}

	user := r.URL.Query().Get("user")

	svc := GetService()

	var entries []model.AuditEntry
	if user != "" {
		entries = svc.QueryByUser(user, count)
	} else {
		entries = svc.Query(count)
	}

	if entries == nil {
		entries = []model.AuditEntry{}
	}

	model.SendSuccess(w, entries)
}
