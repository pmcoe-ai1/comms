-- ─────────────────────────────────────────────────────────────────────────────
-- GENERATED: Immutability triggers for subscription-billing.canonical-model.yaml v1.1.0
-- Source: generate-immutable-triggers.js
-- Generated at: 2026-03-06T08:03:50.081Z
--
-- These triggers enforce immutable: true fields at the database level.
-- TypeScript readonly only prevents compile-time mutation.
-- These triggers prevent runtime mutation via direct SQL or ORM bypass.
-- ─────────────────────────────────────────────────────────────────────────────

-- Generic immutability enforcement function
-- Takes immutable column names as TG_ARGV and raises if any changed.
CREATE OR REPLACE FUNCTION enforce_immutable_fields()
RETURNS TRIGGER AS $$
DECLARE
  col_name TEXT;
  old_val TEXT;
  new_val TEXT;
BEGIN
  FOR i IN 0 .. TG_NARGS - 1 LOOP
    col_name := TG_ARGV[i];
    EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', col_name, col_name)
      USING OLD, NEW
      INTO old_val, new_val;
    IF old_val IS DISTINCT FROM new_val THEN
      RAISE EXCEPTION 'IMMUTABLE_FIELD_VIOLATION: Cannot update immutable field "%.%" (old=%, new=%)',
        TG_TABLE_NAME, col_name, old_val, new_val;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Entity: Plan (plan)
-- Immutable fields: id, createdAt
DROP TRIGGER IF EXISTS trg_immutable_plan ON "Plan";
CREATE TRIGGER trg_immutable_plan
  BEFORE UPDATE ON "Plan"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_immutable_fields('id', 'createdAt');

-- Entity: Subscription (subscription)
-- Immutable fields: id, customerId, anchorDate, createdAt
DROP TRIGGER IF EXISTS trg_immutable_subscription ON "Subscription";
CREATE TRIGGER trg_immutable_subscription
  BEFORE UPDATE ON "Subscription"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_immutable_fields('id', 'customerId', 'anchorDate', 'createdAt');

-- Entity: BillingRecord (billing-record)
-- Immutable fields: id, subscriptionId, type, amount, periodStart, periodEnd, createdAt
DROP TRIGGER IF EXISTS trg_immutable_billing_record ON "BillingRecord";
CREATE TRIGGER trg_immutable_billing_record
  BEFORE UPDATE ON "BillingRecord"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_immutable_fields('id', 'subscriptionId', 'type', 'amount', 'periodStart', 'periodEnd', 'createdAt');

-- Entity: Customer (customer)
-- Immutable fields: id, createdAt
DROP TRIGGER IF EXISTS trg_immutable_customer ON "Customer";
CREATE TRIGGER trg_immutable_customer
  BEFORE UPDATE ON "Customer"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_immutable_fields('id', 'createdAt');

-- Summary: 4 triggers for 4 entities
-- Total immutable fields enforced: 15