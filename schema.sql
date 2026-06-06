-- ==========================================
-- USERS
-- ==========================================

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR UNIQUE,
    name VARCHAR NOT NULL,
    password_hash VARCHAR NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    age INTEGER
);

-- ==========================================
-- PARTICIPANTS
-- ==========================================

CREATE TABLE participants (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR NOT NULL,
    color VARCHAR(7),

    CONSTRAINT fk_participant_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- ==========================================
-- FINANCIAL ENTRIES
-- ==========================================

CREATE TABLE financial_entries (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,
    participant_id BIGINT,

    amount NUMERIC(10,2) NOT NULL,
    transaction_date DATE NOT NULL,
    description VARCHAR(255) NOT NULL,
    source VARCHAR(50) NOT NULL,

    is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,

    installment_number INTEGER NOT NULL,
    installment_total INTEGER NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_financial_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_financial_participant
        FOREIGN KEY(participant_id)
        REFERENCES participants(id)
        ON DELETE SET NULL
);

-- ==========================================
-- ÍNDICES
-- ==========================================

CREATE INDEX idx_financial_user
ON financial_entries(user_id);

CREATE INDEX idx_financial_participant
ON financial_entries(participant_id);

CREATE INDEX idx_financial_date
ON financial_entries(transaction_date);

-- ==========================================
-- TRIGGER UPDATED_AT
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_financial_entries_updated_at
BEFORE UPDATE ON financial_entries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();