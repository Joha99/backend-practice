# Simple per-client throttle used by the partner API and the verify endpoint.
# Usage:
#   PARTNER_THROTTLE = Throttle.new(limit: 100, window: 60)
#   VERIFY_THROTTLE  = Throttle.new(limit: 5, window: 600)
#   raise TooManyRequests unless VERIFY_THROTTLE.allow?(client_id)

class Throttle
  @@counts = {}
  @@window_started = {}

  attr_reader :limit, :window

  def initialize(limit:, window:, clock: -> { Time.now.to_f })
    @limit = limit
    @window = window
    @clock = clock
  end

  def allow?(client_id)
    now = @clock.call
    started = @@window_started[client_id]

    if started.nil? || now - started > @window
      @@window_started[client_id] = now
      @@counts[client_id] = 0
    end

    if @@counts[client_id] < @limit
      @@counts[client_id] += 1
      true
    else
      false
    end
  end

  def remaining(client_id)
    @limit - (@@counts[client_id] || 0)
  end

  def reset!(client_id)
    @@counts.delete(client_id)
    @@window_started.delete(client_id)
  end
end
