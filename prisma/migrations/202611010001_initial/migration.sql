-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "group" TEXT NOT NULL DEFAULT 'LOCAL',
    "notes" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "chassis" TEXT,
    "acquisition" TEXT NOT NULL DEFAULT 'INVENTORY',
    "location" TEXT NOT NULL DEFAULT 'JAPAN',
    "status" TEXT NOT NULL DEFAULT 'JAPAN_POOL',
    "committedAt" TIMESTAMP(3),
    "supplierId" TEXT,
    "shippingEstimate" BIGINT NOT NULL DEFAULT 1200000,
    "notes" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "originalAmount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AGREED',
    "agreedAt" TIMESTAMP(3) NOT NULL,
    "soldAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "installments" JSONB NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "billId" TEXT,
    "saleId" TEXT,
    "amount" BIGINT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "account" TEXT NOT NULL DEFAULT 'BUSINESS',
    "reconciliation" TEXT NOT NULL DEFAULT 'UNRECONCILED',
    "reconciliationNote" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adjustment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "billId" TEXT,
    "saleId" TEXT,
    "amount" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL DEFAULT 'business',
    "shippingEstimate" BIGINT NOT NULL DEFAULT 1200000,
    "vatNote" TEXT NOT NULL DEFAULT 'VAT registration and treatment not configured',
    "categories" JSONB NOT NULL,
    "plans" JSONB NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_code_key" ON "Vehicle"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_chassis_key" ON "Vehicle"("chassis");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_reference_key" ON "Bill"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_reference_key" ON "Sale"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_vehicleId_key" ON "Sale"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Adjustment_reference_key" ON "Adjustment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Document_key_key" ON "Document"("key");

-- CreateIndex
CREATE INDEX "Audit_createdAt_idx" ON "Audit"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Domain constraints supplement application validation.
ALTER TABLE "User" ADD CONSTRAINT user_role CHECK (role IN ('ADMIN','STAFF'));
ALTER TABLE "Party" ADD CONSTRAINT party_kind CHECK (kind IN ('SUPPLIER','CUSTOMER'));
ALTER TABLE "Party" ADD CONSTRAINT party_group CHECK ("group" IN ('JAPAN','IMPORT_PARTNER','LOCAL'));
ALTER TABLE "Vehicle" ADD CONSTRAINT vehicle_status CHECK (status IN ('JAPAN_POOL','COMMITTED','AWAITING_SHIPMENT','IN_TRANSIT','UAE_INVENTORY','SOLD','DELIVERED'));
ALTER TABLE "Vehicle" ADD CONSTRAINT vehicle_commitment CHECK (status='JAPAN_POOL' OR "committedAt" IS NOT NULL);
ALTER TABLE "Vehicle" ADD CONSTRAINT vehicle_estimate CHECK ("shippingEstimate">=0);
ALTER TABLE "Vehicle" ADD CONSTRAINT vehicle_acquisition CHECK (acquisition IN ('INVENTORY','CUSTOMER_SOURCED'));
ALTER TABLE "Bill" ADD CONSTRAINT bill_positive CHECK (amount>0);
ALTER TABLE "Bill" ADD CONSTRAINT bill_purchase_vehicle CHECK (category<>'PURCHASE' OR "vehicleId" IS NOT NULL);
ALTER TABLE "Bill" ADD CONSTRAINT bill_dates CHECK ("dueAt" IS NULL OR "dueAt">="issuedAt");
ALTER TABLE "Sale" ADD CONSTRAINT sale_positive CHECK (amount>0);
ALTER TABLE "Sale" ADD CONSTRAINT sale_type CHECK (type IN ('AS_IS','CUSTOMIZED'));
ALTER TABLE "Sale" ADD CONSTRAINT sale_status_dates CHECK ((status='AGREED' AND "soldAt" IS NULL AND "deliveredAt" IS NULL) OR (status='SOLD' AND "soldAt">="agreedAt" AND "deliveredAt" IS NULL) OR (status='DELIVERED' AND "soldAt">="agreedAt" AND "deliveredAt">="soldAt"));
ALTER TABLE "Payment" ADD CONSTRAINT payment_positive CHECK (amount>0);
ALTER TABLE "Payment" ADD CONSTRAINT payment_allocation CHECK ((kind='SUPPLIER_PAYMENT' AND "billId" IS NOT NULL AND "saleId" IS NULL) OR (kind IN ('CUSTOMER_RECEIPT','CUSTOMER_REFUND') AND "saleId" IS NOT NULL AND "billId" IS NULL) OR (kind IN ('OWNER_CONTRIBUTION','OWNER_WITHDRAWAL') AND "saleId" IS NULL AND "billId" IS NULL));
ALTER TABLE "Payment" ADD CONSTRAINT payment_status CHECK (status IN ('PENDING','VERIFIED','REVERSED'));
ALTER TABLE "Payment" ADD CONSTRAINT payment_account CHECK (account IN ('BUSINESS','PERSONAL'));
ALTER TABLE "Payment" ADD CONSTRAINT payment_method CHECK (method IN ('BANK_TRANSFER','CASH'));
ALTER TABLE "Payment" ADD CONSTRAINT payment_reconciliation CHECK (reconciliation IN ('UNRECONCILED','MATCHED'));
ALTER TABLE "Payment" ADD CONSTRAINT payment_verified CHECK (status<>'VERIFIED' OR "verifiedAt" IS NOT NULL);
ALTER TABLE "Payment" ADD CONSTRAINT payment_reversed CHECK (status<>'REVERSED' OR ("reversedAt" IS NOT NULL AND length("reversalReason")>=5));
ALTER TABLE "Adjustment" ADD CONSTRAINT adjustment_positive CHECK (amount>0);
ALTER TABLE "Adjustment" ADD CONSTRAINT adjustment_target CHECK (("billId" IS NOT NULL)::integer + ("saleId" IS NOT NULL)::integer = 1);
ALTER TABLE "Document" ADD CONSTRAINT document_size CHECK (size>0 AND size<=10485760);

CREATE FUNCTION reject_posted_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Posted financial records and audit events cannot be overwritten or deleted'; END;
$$;
CREATE TRIGGER bill_immutable BEFORE UPDATE OR DELETE ON "Bill" FOR EACH ROW EXECUTE FUNCTION reject_posted_change();
CREATE TRIGGER adjustment_immutable BEFORE UPDATE OR DELETE ON "Adjustment" FOR EACH ROW EXECUTE FUNCTION reject_posted_change();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON "Audit" FOR EACH ROW EXECUTE FUNCTION reject_posted_change();
CREATE FUNCTION protect_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payments must be reversed, never deleted'; END IF;
 IF (NEW."idempotencyKey",NEW.reference,NEW.kind,NEW."billId",NEW."saleId",NEW.amount,NEW.date,NEW.method,NEW.account,NEW.notes) IS DISTINCT FROM (OLD."idempotencyKey",OLD.reference,OLD.kind,OLD."billId",OLD."saleId",OLD.amount,OLD.date,OLD.method,OLD.account,OLD.notes) THEN RAISE EXCEPTION 'Payment posting is immutable'; END IF;
 IF OLD.status='REVERSED' OR (OLD.status='VERIFIED' AND NEW.status='PENDING') THEN RAISE EXCEPTION 'Invalid payment state transition'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER payment_protected BEFORE UPDATE OR DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION protect_payment();
CREATE FUNCTION protect_sale() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Sale agreements cannot be deleted'; END IF;
 IF (NEW.reference,NEW."vehicleId",NEW."customerId",NEW.type,NEW.amount,NEW."agreedAt",NEW.installments) IS DISTINCT FROM (OLD.reference,OLD."vehicleId",OLD."customerId",OLD.type,OLD.amount,OLD."agreedAt",OLD.installments) THEN RAISE EXCEPTION 'Use a credit to adjust a sale'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER sale_protected BEFORE UPDATE OR DELETE ON "Sale" FOR EACH ROW EXECUTE FUNCTION protect_sale();
CREATE INDEX bill_supplier_due ON "Bill" ("supplierId","dueAt");
CREATE INDEX bill_vehicle ON "Bill" ("vehicleId");
CREATE INDEX payment_bill_status ON "Payment" ("billId",status);
CREATE INDEX payment_sale_status ON "Payment" ("saleId",status);
CREATE INDEX document_entity ON "Document" ("entityType","entityId");
