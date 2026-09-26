---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['prd.md', 'architecture.md']
---

# Portal de Proveedores - Epic Breakdown

## Overview

Este documento provee el desglose completo de epics y stories para Portal de Proveedores.

## Requirements Inventory

### Functional Requirements

- **FR001**: El proveedor puede registrarse con NIT y correo corporativo.
- **FR002**: El proveedor puede iniciar sesión con MFA.
- **FR003**: El comprador puede publicar una orden de compra.
- **FR004**: El proveedor recibe notificación de nuevas órdenes.
- ~~**FR005**: El proveedor exporta sus órdenes a Excel.~~ **ELIMINADO 2026-09-03.** El identificador no se reutiliza.

### NonFunctional Requirements

- **NFR001**: El login debe responder en menos de 800ms en p95.

### UX Design Requirements

- **UX-DR01**: Todos los formularios cumplen WCAG 2.1 AA.

### FR Coverage Map

| FR | Epic | Story |
| --- | --- | --- |
| FR001 | 1 | 1.1 |
| FR002 | 1 | 1.2 |
| FR003 | 2 | 2.1 |
| FR004 | 2 | 2.2 |

## Epic List

1. Autenticación y Sesión de Proveedores
2. Órdenes de Compra

## Epic 1: Autenticación y Sesión de Proveedores

Permitir que un proveedor se registre, acceda de forma segura y mantenga una sesión confiable en el portal.

### Story 1.1: Registro de proveedor con NIT

As a proveedor,
I want registrarme en el portal usando mi NIT y correo corporativo,
So that puedo acceder a las órdenes de compra sin llamar al comprador.

**Acceptance Criteria:**

**Given** que estoy en la página de registro y no tengo cuenta
**When** ingreso un NIT válido y un correo con dominio corporativo
**Then** el sistema crea la cuenta en estado "pendiente de verificación"
**And** envía un correo de verificación con un enlace de un solo uso
**And** registra el evento en la bitácora de auditoría

**Given** que ingreso un NIT ya registrado
**When** envío el formulario
**Then** el sistema rechaza el registro con el mensaje "NIT ya registrado"

Cubre FR001.

### Story 1.2: Inicio de sesión con MFA

As a proveedor registrado,
I want iniciar sesión con contraseña y un segundo factor,
So that mi cuenta queda protegida ante robo de credenciales.

**Acceptance Criteria:**

**Given** que tengo una cuenta verificada y MFA activo
**When** ingreso credenciales correctas y el código TOTP vigente
**Then** el sistema abre la sesión y responde en menos de 800ms en p95

**Given** que ingreso un código TOTP vencido
**When** confirmo el segundo factor
**Then** el sistema rechaza el acceso
**And** incrementa el contador de intentos fallidos

Cubre FR002 y NFR001.

## Epic 2: Órdenes de Compra

Permitir que el comprador publique órdenes y que el proveedor las reciba y consulte.

### Story 2.1: Publicar orden de compra

As a comprador,
I want publicar una orden de compra dirigida a un proveedor,
So that el proveedor puede cotizar sin intercambio de correos.

**Acceptance Criteria:**

**Given** que tengo rol de comprador autenticado
**When** completo la orden con proveedor, ítems y fecha límite
**Then** el sistema publica la orden en estado "abierta"

Cubre FR003. Depende de Story 1.2 porque requiere sesión autenticada.

### Story 2.2: Notificación de nueva orden

As a proveedor,
I want recibir una notificación cuando me publiquen una orden,
So that no tengo que revisar el portal manualmente.

**Acceptance Criteria:**

**Given** que soy el proveedor destinatario de una orden recién publicada
**When** la orden pasa a estado "abierta"
**Then** el sistema me envía una notificación por correo y en la campana del portal

Cubre FR004.
