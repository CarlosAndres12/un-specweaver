## ADDED Requirements

### Requirement: Generador determinístico de Product Brief y PRD con requisitos numerados
The system SHALL support generador determinístico de Product Brief y PRD con requisitos numerados.

#### Scenario: Se alcanza el Paso 5 (Previsualización)
- **GIVEN** los datos completados del asistente
- **WHEN** se alcanza el Paso 5 (Previsualización)
- **THEN** la UI genera una vista previa renderizada en vivo de `_bmad-output/planning-artifacts/product-brief.md` y `prd.md` con tabla de requisitos normativos numerados (`FR-XXX`, `NFR-XXX`) y diagramas de arquitectura

#### Scenario: Se inspeccionan los requisitos
- **GIVEN** el PRD generado
- **WHEN** se inspeccionan los requisitos
- **THEN** cada requisito contiene su código (`FR-001`, `FR-002`, `NFR-001`), descripción normativa con el verbo DEBE, y prioridad (Must/Should)
