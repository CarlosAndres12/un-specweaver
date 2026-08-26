---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['prd.md']
---

# Supplier Portal - Epic Breakdown

## Overview

Complete epic and story breakdown for Supplier Portal.

## Requirements Inventory

### Functional Requirements

- **FR001**: A supplier can register with a tax ID and a corporate email.
- **FR002**: A supplier can sign in with MFA.
- **FR003**: A buyer can publish a purchase order.

### NonFunctional Requirements

- **NFR001**: Sign-in must respond in under 800ms at p95.

## Epic List

1. Supplier Authentication
2. Purchase Orders

## Epic 1: Supplier Authentication

Let a supplier register, sign in securely and keep a reliable session in the portal.

### Story 1.1: Supplier self-registration

As a supplier,
I want to register in the portal using my tax ID and my corporate email,
So that I can reach purchase orders without calling the buyer.

**Acceptance Criteria:**

**Given** I am on the registration page and have no account
**When** I submit a valid tax ID and a corporate-domain email
**Then** the system creates the account in "pending verification" state
**And** sends a verification email with a single-use link

**Given** I submit a tax ID that is already registered
**When** I confirm the form
**Then** the system rejects the registration with "tax ID already registered"

Covers FR001.

### Story 1.2: Sign in with MFA

As a registered supplier,
I want to sign in with my password and a second factor,
So that my account stays protected against credential theft.

**Acceptance Criteria:**

**Given** I have a verified account with MFA enabled
**When** I submit correct credentials and a valid TOTP code
**Then** the system opens the session in under 800ms at p95

Covers FR002 and NFR001.

## Epic 2: Purchase Orders

Let a buyer publish orders and let suppliers receive them.

### Story 2.1: Publish a purchase order

As a buyer,
I want to publish a purchase order addressed to a supplier,
So that the supplier can quote without exchanging emails.

**Acceptance Criteria:**

**Given** I am an authenticated buyer
**When** I complete the order with supplier, items and a due date
**Then** the system publishes the order in "open" state

Covers FR003. Depends on Story 1.2 because it requires an authenticated session.
