"""Cashback calculation for Shop orders.

Used by the nightly job and by the account page preview.
"""

TIERS = [
    # (min order total in dollars, rate)
    (0, 0.02),
    (50, 0.03),
    (200, 0.05),
]

MONTHLY_CAP = 100.0


def rate_for(total):
    rate = TIERS[0][1]
    for minimum, r in TIERS:
        if total > minimum:
            rate = r
    return rate


def cashback_for_order(order, history=[]):
    """order: dict with 'member_id', 'total', 'month' ('2026-11').
    history: earlier cashback records for this member this month.
    Returns the cashback amount in dollars (2 decimal places)."""
    earned = sum(h["amount"] for h in history if h["month"] == order["month"])
    amount = order["total"] * rate_for(order["total"])
    if earned + amount > MONTHLY_CAP:
        amount = max(0, MONTHLY_CAP - earned)
    amount = round(amount, 2)
    history.append({"member_id": order["member_id"], "month": order["month"], "amount": amount})
    return amount


def preview(member_id, total, month):
    return cashback_for_order({"member_id": member_id, "total": total, "month": month})


if __name__ == "__main__":
    print(preview("m1", 120.0, "2026-11"))
