"""
FinanceBank — MongoDB Atlas Data Population Script
Populates: credit_card_transactions collection

Scenario:
- Fake credit card transactions for a financial services demo
- Designed for Databricks ingestion into Bronze/Silver/Gold
- Useful for analytics, fraud/risk monitoring, and MLflow demo

Database:
- financebank

Collection:
- credit_card_transactions
"""

import random
from datetime import datetime, timedelta
from pymongo import MongoClient
from faker import Faker


# ─────────────────────────────────────────────
# CONFIG — update your connection string here
# ─────────────────────────────────────────────
MONGO_URI = "mongodb+srv://admin:admin123@cluster0.epzjaqh.mongodb.net/?appName=Cluster0"
DB_NAME = "financebank"
COLLECTION_NAME = "credit_card_transactions"

fake = Faker("pt_BR")
random.seed(42)


# ─────────────────────────────────────────────
# REFERENCE DATA
# ─────────────────────────────────────────────

BRAZIL_STATES = [
    "SP", "RJ", "MG", "RS", "PR", "SC", "BA", "PE", "GO", "DF"
]

STATE_WEIGHTS = [
    0.32, 0.14, 0.12, 0.08, 0.08, 0.06, 0.06, 0.05, 0.05, 0.04
]

CHANNELS = [
    "pos",
    "ecommerce",
    "mobile_wallet",
    "recurring_payment",
    "atm_cash_advance"
]

CHANNEL_WEIGHTS = [
    0.42,
    0.34,
    0.13,
    0.08,
    0.03
]

STATUSES = [
    "approved",
    "approved",
    "approved",
    "approved",
    "declined",
    "reversed",
    "chargeback"
]

CARD_BRANDS = [
    "Visa",
    "Mastercard",
    "Elo"
]

CARD_BRAND_WEIGHTS = [
    0.42,
    0.40,
    0.18
]

CARD_TYPES = [
    "gold",
    "platinum",
    "black",
    "standard"
]

CARD_TYPE_WEIGHTS = [
    0.35,
    0.25,
    0.10,
    0.30
]

ENTRY_MODES = [
    "chip",
    "contactless",
    "online",
    "magstripe",
    "manual_entry"
]

ENTRY_MODE_WEIGHTS = [
    0.36,
    0.28,
    0.25,
    0.06,
    0.05
]

MERCHANTS = [
    {
        "merchant_name": "Mercado Bom Preço",
        "merchant_category": "grocery",
        "mcc": "5411",
        "amount_range": (25.00, 450.00)
    },
    {
        "merchant_name": "Posto Rota Sul",
        "merchant_category": "fuel",
        "mcc": "5541",
        "amount_range": (80.00, 380.00)
    },
    {
        "merchant_name": "Farmácia Vida",
        "merchant_category": "pharmacy",
        "mcc": "5912",
        "amount_range": (20.00, 320.00)
    },
    {
        "merchant_name": "TechStore Online",
        "merchant_category": "electronics",
        "mcc": "5732",
        "amount_range": (150.00, 8500.00)
    },
    {
        "merchant_name": "Fashion Mall",
        "merchant_category": "apparel",
        "mcc": "5651",
        "amount_range": (60.00, 1800.00)
    },
    {
        "merchant_name": "FlyNow Viagens",
        "merchant_category": "travel",
        "mcc": "4722",
        "amount_range": (500.00, 12000.00)
    },
    {
        "merchant_name": "Hotel Central",
        "merchant_category": "hospitality",
        "mcc": "7011",
        "amount_range": (300.00, 5000.00)
    },
    {
        "merchant_name": "StreamPlus",
        "merchant_category": "subscription",
        "mcc": "4899",
        "amount_range": (19.90, 89.90)
    },
    {
        "merchant_name": "App Delivery",
        "merchant_category": "food_delivery",
        "mcc": "5814",
        "amount_range": (25.00, 180.00)
    },
    {
        "merchant_name": "Cash Advance ATM",
        "merchant_category": "cash_advance",
        "mcc": "6011",
        "amount_range": (200.00, 3000.00)
    }
]

DECLINE_REASONS = [
    "insufficient_limit",
    "suspected_fraud",
    "invalid_cvv",
    "expired_card",
    "blocked_card",
    "issuer_unavailable"
]

FRAUD_RULES = [
    "high_amount_outlier",
    "unusual_location",
    "high_velocity",
    "foreign_transaction",
    "risky_merchant_category",
    "manual_entry_high_amount"
]


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def random_date(start: datetime, end: datetime) -> datetime:
    delta = end - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))


def month_end_weight(dt: datetime) -> float:
    """
    Creates a small spike near month end.
    Useful for showing peak-load / regulatory / reporting pressure.
    """
    if dt.day >= 25:
        return 2.4
    if dt.day <= 3:
        return 1.7
    return 1.0


def holiday_spike_weight(dt: datetime) -> float:
    """
    Adds a transaction spike around Black Friday / holiday shopping.
    """
    spike_start = datetime(2024, 11, 25)
    spike_end = datetime(2024, 12, 2)

    if spike_start <= dt <= spike_end:
        peak = datetime(2024, 11, 29)
        dist = abs((dt - peak).days)
        return max(7.0 - dist * 1.3, 2.0)

    return 1.0


def generate_weighted_dates(n: int, start: datetime, end: datetime) -> list:
    dates = []

    while len(dates) < n:
        dt = random_date(start, end)

        weight = max(
            month_end_weight(dt),
            holiday_spike_weight(dt)
        )

        if random.random() < weight / 7.0:
            dates.append(dt)

    return sorted(dates[:n])


def masked_card_number() -> str:
    return f"**** **** **** {random.randint(1000, 9999)}"


def generate_customer_pool(n_customers: int = 2500) -> list:
    customers = []

    for i in range(1, n_customers + 1):
        state = random.choices(BRAZIL_STATES, weights=STATE_WEIGHTS)[0]

        customers.append({
            "customer_id": f"CUST-{i:06d}",
            "account_id": f"ACC-{i:06d}",
            "card_id": f"CARD-{i:06d}",
            "customer_name": fake.name(),
            "customer_state": state,
            "customer_city": fake.city(),
            "card_brand": random.choices(CARD_BRANDS, weights=CARD_BRAND_WEIGHTS)[0],
            "card_type": random.choices(CARD_TYPES, weights=CARD_TYPE_WEIGHTS)[0],
            "credit_limit": random.choice([
                1500, 2500, 4000, 7000, 10000, 15000, 25000, 40000
            ]),
            "risk_profile": random.choices(
                ["low", "medium", "high"],
                weights=[0.55, 0.35, 0.10]
            )[0]
        })

    return customers


def calculate_fraud_probability(
    amount: float,
    channel: str,
    merchant_category: str,
    entry_mode: str,
    is_international: bool,
    customer_risk_profile: str
) -> float:
    probability = 0.01

    if amount > 3000:
        probability += 0.04

    if amount > 8000:
        probability += 0.08

    if channel == "ecommerce":
        probability += 0.015

    if channel == "atm_cash_advance":
        probability += 0.035

    if merchant_category in ["travel", "electronics", "cash_advance"]:
        probability += 0.025

    if entry_mode == "manual_entry":
        probability += 0.035

    if is_international:
        probability += 0.055

    if customer_risk_profile == "medium":
        probability += 0.015

    if customer_risk_profile == "high":
        probability += 0.045

    return min(probability, 0.65)


def risk_score_from_probability(probability: float) -> int:
    """
    Returns a simple synthetic risk score from 0 to 100.
    Higher means riskier.
    """
    base = int(probability * 100)
    noise = random.randint(0, 18)
    return min(base + noise, 100)


def risk_band(score: int) -> str:
    if score >= 75:
        return "critical"
    if score >= 50:
        return "high"
    if score >= 25:
        return "medium"
    return "low"


# ─────────────────────────────────────────────
# BUILD TRANSACTIONS
# ─────────────────────────────────────────────

def build_credit_card_transactions(
    n: int = 15000,
    n_customers: int = 2500
) -> list:
    customers = generate_customer_pool(n_customers)

    start = datetime(2024, 8, 1)
    end = datetime(2024, 12, 31, 23, 59)

    dates = generate_weighted_dates(n, start, end)

    transactions = []

    for i, transaction_date in enumerate(dates, start=1):
        customer = random.choice(customers)

        channel = random.choices(CHANNELS, weights=CHANNEL_WEIGHTS)[0]

        merchant = random.choice(MERCHANTS)

        # Keep ATM cash advance coherent with merchant/category
        if channel == "atm_cash_advance":
            merchant = next(m for m in MERCHANTS if m["merchant_category"] == "cash_advance")

        low, high = merchant["amount_range"]
        amount = round(random.uniform(low, high), 2)

        # Make subscriptions smaller and recurring-like
        if merchant["merchant_category"] == "subscription":
            amount = random.choice([19.90, 29.90, 39.90, 49.90, 59.90, 79.90])

        # Occasional high-value outlier
        if random.random() < 0.012:
            amount = round(amount * random.uniform(2.0, 4.5), 2)

        installments = 1
        if merchant["merchant_category"] in ["electronics", "travel", "apparel"] and amount > 300:
            installments = random.choices(
                [1, 2, 3, 6, 10, 12],
                weights=[0.25, 0.15, 0.18, 0.20, 0.14, 0.08]
            )[0]

        is_international = random.random() < 0.035

        transaction_state = random.choices(BRAZIL_STATES, weights=STATE_WEIGHTS)[0]
        transaction_city = fake.city()

        entry_mode = random.choices(ENTRY_MODES, weights=ENTRY_MODE_WEIGHTS)[0]

        fraud_probability = calculate_fraud_probability(
            amount=amount,
            channel=channel,
            merchant_category=merchant["merchant_category"],
            entry_mode=entry_mode,
            is_international=is_international,
            customer_risk_profile=customer["risk_profile"]
        )

        is_suspicious = random.random() < fraud_probability
        risk_score = risk_score_from_probability(fraud_probability)
        risk_level = risk_band(risk_score)

        status = random.choice(STATUSES)

        # Suspicious transactions are more likely to be declined or chargeback
        if is_suspicious:
            status = random.choices(
                ["approved", "declined", "chargeback", "reversed"],
                weights=[0.45, 0.35, 0.12, 0.08]
            )[0]

        authorization_code = None
        decline_reason = None

        if status == "approved":
            authorization_code = f"AUTH-{random.randint(100000, 999999)}"
        elif status == "declined":
            decline_reason = random.choice(DECLINE_REASONS)

        fraud_rule_triggered = None
        if is_suspicious:
            fraud_rule_triggered = random.choice(FRAUD_RULES)

        available_limit_before = round(random.uniform(0.05, 1.0) * customer["credit_limit"], 2)
        available_limit_after = max(round(available_limit_before - amount, 2), 0)

        transaction = {
            "transaction_id": f"CCTXN-{i:09d}",
            "customer_id": customer["customer_id"],
            "account_id": customer["account_id"],
            "card_id": customer["card_id"],
            "masked_card_number": masked_card_number(),

            "transaction_timestamp": transaction_date,
            "transaction_date": transaction_date.strftime("%Y-%m-%d"),
            "transaction_month": transaction_date.strftime("%Y-%m"),

            "amount": amount,
            "currency": "BRL",
            "installments": installments,
            "installment_amount": round(amount / installments, 2),

            "merchant_name": merchant["merchant_name"],
            "merchant_category": merchant["merchant_category"],
            "mcc": merchant["mcc"],

            "channel": channel,
            "entry_mode": entry_mode,
            "status": status,
            "authorization_code": authorization_code,
            "decline_reason": decline_reason,

            "card_brand": customer["card_brand"],
            "card_type": customer["card_type"],
            "credit_limit": customer["credit_limit"],
            "available_limit_before": available_limit_before,
            "available_limit_after": available_limit_after,

            "customer_state": customer["customer_state"],
            "customer_city": customer["customer_city"],
            "transaction_state": transaction_state,
            "transaction_city": transaction_city,
            "is_international": is_international,

            "customer_risk_profile": customer["risk_profile"],
            "risk_score": risk_score,
            "risk_band": risk_level,
            "is_suspicious": is_suspicious,
            "fraud_rule_triggered": fraud_rule_triggered,

            "is_month_end": transaction_date.day >= 25,
            "is_holiday_spike": datetime(2024, 11, 25) <= transaction_date <= datetime(2024, 12, 2),

            "source_system": "mongodb_card_authorization",
            "created_at": transaction_date,
            "updated_at": transaction_date + timedelta(minutes=random.randint(1, 240))
        }

        transactions.append(transaction)

    return transactions


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    print("Connecting to MongoDB Atlas...")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    print(f"Using database: {DB_NAME}")
    print(f"Dropping collection if exists: {COLLECTION_NAME}")
    db[COLLECTION_NAME].drop()

    print("\nBuilding fake credit card transactions...")
    transactions = build_credit_card_transactions(
        n=15000,
        n_customers=2500
    )

    print("\nInserting into Atlas...")
    batch_size = 1000

    for i in range(0, len(transactions), batch_size):
        db[COLLECTION_NAME].insert_many(transactions[i:i + batch_size])

    print(f"  ✓ {COLLECTION_NAME}: {len(transactions):,} documents inserted")

    print("\nCreating indexes...")
    db[COLLECTION_NAME].create_index("transaction_id", unique=True)
    db[COLLECTION_NAME].create_index("customer_id")
    db[COLLECTION_NAME].create_index("account_id")
    db[COLLECTION_NAME].create_index("card_id")
    db[COLLECTION_NAME].create_index("transaction_timestamp")
    db[COLLECTION_NAME].create_index("transaction_month")
    db[COLLECTION_NAME].create_index("merchant_category")
    db[COLLECTION_NAME].create_index("channel")
    db[COLLECTION_NAME].create_index("status")
    db[COLLECTION_NAME].create_index("risk_band")
    db[COLLECTION_NAME].create_index("is_suspicious")
    db[COLLECTION_NAME].create_index("is_month_end")
    db[COLLECTION_NAME].create_index("is_holiday_spike")
    print("  ✓ Indexes created")

    total_amount = sum(t["amount"] for t in transactions)
    approved = sum(1 for t in transactions if t["status"] == "approved")
    declined = sum(1 for t in transactions if t["status"] == "declined")
    suspicious = sum(1 for t in transactions if t["is_suspicious"])
    chargebacks = sum(1 for t in transactions if t["status"] == "chargeback")
    month_end = sum(1 for t in transactions if t["is_month_end"])
    holiday_spike = sum(1 for t in transactions if t["is_holiday_spike"])

    avg_ticket = total_amount / len(transactions)

    print("\n── Summary ──────────────────────────────────")
    print(f"  Total transactions:      {len(transactions):,}")
    print(f"  Total amount:            R$ {total_amount:,.2f}")
    print(f"  Avg transaction amount:  R$ {avg_ticket:,.2f}")
    print(f"  Approved transactions:   {approved:,} ({approved / len(transactions) * 100:.1f}%)")
    print(f"  Declined transactions:   {declined:,} ({declined / len(transactions) * 100:.1f}%)")
    print(f"  Suspicious transactions: {suspicious:,} ({suspicious / len(transactions) * 100:.1f}%)")
    print(f"  Chargebacks:             {chargebacks:,} ({chargebacks / len(transactions) * 100:.1f}%)")
    print(f"  Month-end transactions:  {month_end:,} ({month_end / len(transactions) * 100:.1f}%)")
    print(f"  Holiday spike txns:      {holiday_spike:,} ({holiday_spike / len(transactions) * 100:.1f}%)")
    print("─────────────────────────────────────────────")

    print("\n✅ Done! Collection ready in Atlas.")
    client.close()


if __name__ == "__main__":
    main()