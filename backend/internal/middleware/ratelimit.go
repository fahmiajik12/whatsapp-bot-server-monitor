package middleware

import (
	"net/http"
	"sync"
	"time"

	"wabot-backend/internal/model"
)

type RateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	limit   int
	window  time.Duration
}

type bucket struct {
	tokens    int
	lastReset time.Time
}

var rateLimiter *RateLimiter

func NewRateLimiter(requestsPerMinute int) *RateLimiter {
	if requestsPerMinute <= 0 {
		requestsPerMinute = 60
	}

	rateLimiter = &RateLimiter{
		buckets: make(map[string]*bucket),
		limit:   requestsPerMinute,
		window:  time.Minute,
	}

	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			rateLimiter.cleanup()
		}
	}()

	return rateLimiter
}

func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-API-Key")
		if key == "" {
			key = r.RemoteAddr
		}

		if !rl.allow(key) {
			w.Header().Set("Retry-After", "60")
			model.SendError(w, http.StatusTooManyRequests, "Terlalu banyak request. Coba lagi nanti.")
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (rl *RateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, exists := rl.buckets[key]
	if !exists {
		rl.buckets[key] = &bucket{
			tokens:    rl.limit - 1,
			lastReset: time.Now(),
		}
		return true
	}

	if time.Since(b.lastReset) > rl.window {
		b.tokens = rl.limit - 1
		b.lastReset = time.Now()
		return true
	}

	if b.tokens <= 0 {
		return false
	}

	b.tokens--
	return true
}

func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	for key, b := range rl.buckets {
		if now.Sub(b.lastReset) > 10*time.Minute {
			delete(rl.buckets, key)
		}
	}
}
