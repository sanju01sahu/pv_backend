import swaggerJsdoc from "swagger-jsdoc";

const jsonContent = { "application/json": { schema: { type: "object", additionalProperties: true } } };
const port = process.env.PORT || "3000";
const serverUrl =
  process.env.SWAGGER_SERVER_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://pv-backend-7aff.onrender.com"
    : `http://localhost:${port}`);

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Photovoltaic Sales Network Management Platform API",
      version: "1.0.0"
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: { message: { type: "string" } },
          required: ["message"]
        },
        HealthResponse: {
          type: "object",
          properties: { ok: { type: "boolean", example: true } },
          required: ["ok"]
        },
        TokenPair: {
          type: "object",
          properties: {
            accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
            refreshToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
          },
          required: ["accessToken", "refreshToken"]
        },
        LoginRequest: {
          type: "object",
          properties: {
            email: { type: "string", format: "email", example: "admin@pv.local" },
            password: { type: "string", example: "Admin123!Secure" }
          },
          required: ["email", "password"],
          example: {
            email: "admin@pv.local",
            password: "Admin123!Secure"
          }
        },
        RefreshTokenRequest: {
          type: "object",
          properties: { refreshToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." } },
          required: ["refreshToken"],
          example: { refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
        },
        LoginLockedResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Account temporarily locked" },
            lockedUntil: { type: "string", format: "date-time" }
          },
          required: ["message", "lockedUntil"]
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "Platform Admin" },
            email: { type: "string", format: "email", example: "admin@pv.local" },
            role: { type: "string", enum: ["ADMIN", "AREA_MANAGER", "AGENT"], example: "ADMIN" },
            managerId: { type: "string", format: "uuid", nullable: true, example: null },
            createdAt: { type: "string", format: "date-time", example: "2026-05-02T09:30:00.000Z" }
          },
          required: ["id", "name", "email", "role", "createdAt"],
          example: {
            id: "9f7e6f63-946c-4a91-ae91-4bded2a5376d",
            name: "Platform Admin",
            email: "admin@pv.local",
            role: "ADMIN",
            managerId: null,
            createdAt: "2026-05-02T09:30:00.000Z"
          }
        },
        UserCreateRequest: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 2, example: "Aditi Sharma" },
            email: { type: "string", format: "email", example: "aditi.sharma@example.com" },
            password: { type: "string", minLength: 12, description: "Must include uppercase, lowercase, number, and special character" },
            role: { type: "string", enum: ["ADMIN", "AREA_MANAGER", "AGENT"], example: "AGENT" },
            managerId: { type: "string", format: "uuid", example: "3a5a44d2-5082-41ed-9d9f-22f9f4d25b5e" }
          },
          required: ["name", "email", "password", "role"],
          example: {
            name: "Aditi Sharma",
            email: "aditi.sharma@example.com",
            password: "SuperString123!",
            role: "AGENT",
            managerId: "3a5a44d2-5082-41ed-9d9f-22f9f4d25b5e"
          }
        },
        UserPatchRequest: {
          type: "object",
          properties: {
            name: { type: "string", example: "Aditi S." },
            managerId: { type: "string", format: "uuid", nullable: true, example: "3a5a44d2-5082-41ed-9d9f-22f9f4d25b5e" }
          },
          example: {
            name: "Aditi S.",
            managerId: "3a5a44d2-5082-41ed-9d9f-22f9f4d25b5e"
          }
        },
        UserWithHierarchy: {
          allOf: [
            { $ref: "#/components/schemas/User" },
            {
              type: "object",
              properties: {
                manager: { anyOf: [{ $ref: "#/components/schemas/User" }, { type: "null" }] },
                team: { type: "array", items: { $ref: "#/components/schemas/User" } }
              }
            }
          ]
        },
        Solution: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "Residential Rooftop 5kW" },
            createdAt: { type: "string", format: "date-time", example: "2026-05-02T09:30:00.000Z" }
          },
          required: ["id", "name", "createdAt"],
          example: {
            id: "2be591f8-4ff9-4dce-bb3d-9f863fddf5c5",
            name: "Residential Rooftop 5kW",
            createdAt: "2026-05-02T09:30:00.000Z"
          }
        },
        SolutionCreateRequest: {
          type: "object",
          properties: { name: { type: "string", minLength: 1, example: "Residential Rooftop 5kW" } },
          required: ["name"],
          example: { name: "Residential Rooftop 5kW" }
        },
        SolutionVersion: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            solutionId: { type: "string", format: "uuid" },
            price: { type: "number", example: 125000 },
            baseCommission: { type: "number", example: 7500 },
            validFrom: { type: "string", format: "date-time", example: "2026-05-01T00:00:00.000Z" },
            validTo: { type: "string", format: "date-time", nullable: true, example: "2026-12-31T23:59:59.000Z" },
            createdBy: { type: "string", format: "uuid" },
            createdAt: { type: "string", format: "date-time", example: "2026-05-02T09:30:00.000Z" }
          },
          required: ["id", "solutionId", "price", "baseCommission", "validFrom", "createdBy", "createdAt"],
          example: {
            id: "c0f191b7-2d4c-4d7f-bae2-e6b4d636c9e7",
            solutionId: "2be591f8-4ff9-4dce-bb3d-9f863fddf5c5",
            price: 125000,
            baseCommission: 7500,
            validFrom: "2026-05-01T00:00:00.000Z",
            validTo: "2026-12-31T23:59:59.000Z",
            createdBy: "9f7e6f63-946c-4a91-ae91-4bded2a5376d",
            createdAt: "2026-05-02T09:30:00.000Z"
          }
        },
        SolutionVersionCreateRequest: {
          type: "object",
          properties: {
            price: { type: "number", exclusiveMinimum: 0, example: 125000 },
            baseCommission: { type: "number", minimum: 0, example: 7500 },
            validFrom: { type: "string", format: "date-time", example: "2026-05-01T00:00:00.000Z" },
            validTo: { type: "string", format: "date-time", example: "2026-12-31T23:59:59.000Z" },
            retroactive: { type: "boolean", default: false, example: false }
          },
          required: ["price", "baseCommission", "validFrom"],
          example: {
            price: 125000,
            baseCommission: 7500,
            validFrom: "2026-05-01T00:00:00.000Z",
            validTo: "2026-12-31T23:59:59.000Z",
            retroactive: false
          }
        },
        SolutionVersionCreateResponse: {
          type: "object",
          properties: {
            version: { $ref: "#/components/schemas/SolutionVersion" },
            recalculatedContracts: { type: "integer" },
            adjustmentsCreated: { type: "integer" }
          },
          required: ["version", "recalculatedContracts", "adjustmentsCreated"]
        },
        Contract: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            agentId: { type: "string", format: "uuid" },
            solutionVersionId: { type: "string", format: "uuid" },
            customerDetails: { type: "object", additionalProperties: true, example: { name: "Ravi Kumar", phone: "+91-9876543210", city: "Hyderabad" } },
            installationDate: { type: "string", format: "date-time", example: "2026-05-15T00:00:00.000Z" },
            status: { type: "string", enum: ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"], example: "ACTIVE" },
            createdAt: { type: "string", format: "date-time", example: "2026-05-02T09:30:00.000Z" }
          },
          required: ["id", "agentId", "solutionVersionId", "customerDetails", "installationDate", "status", "createdAt"]
        },
        ContractCreateRequest: {
          type: "object",
          properties: {
            solutionId: { type: "string", format: "uuid", example: "2be591f8-4ff9-4dce-bb3d-9f863fddf5c5" },
            customerDetails: { type: "object", additionalProperties: true, example: { name: "Ravi Kumar", phone: "+91-9876543210", city: "Hyderabad" } },
            installationDate: { type: "string", format: "date-time", example: "2026-05-15T00:00:00.000Z" },
            status: { type: "string", enum: ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"], default: "ACTIVE", example: "ACTIVE" },
            agentId: { type: "string", format: "uuid", description: "Required for non-AGENT callers", example: "7e23d6e8-8e0f-44fa-8ff1-3db8fca29d2f" }
          },
          required: ["solutionId", "customerDetails", "installationDate"],
          example: {
            solutionId: "2be591f8-4ff9-4dce-bb3d-9f863fddf5c5",
            customerDetails: { name: "Ravi Kumar", phone: "+91-9876543210", city: "Hyderabad" },
            installationDate: "2026-05-15T00:00:00.000Z",
            status: "ACTIVE",
            agentId: "7e23d6e8-8e0f-44fa-8ff1-3db8fca29d2f"
          }
        },
        Commission: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            contractId: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            amount: { type: "number", example: 7500 },
            type: { type: "string", enum: ["BASE", "BONUS"], example: "BASE" },
            createdAt: { type: "string", format: "date-time", example: "2026-05-02T09:30:00.000Z" }
          },
          required: ["id", "contractId", "userId", "amount", "type", "createdAt"]
        },
        MonthlyBonusRunRequest: {
          type: "object",
          properties: {
            year: { type: "integer", minimum: 2000 },
            month: { type: "integer", minimum: 1, maximum: 12 }
          },
          required: ["year", "month"],
          example: { year: 2026, month: 5 }
        },
        MonthlyBonusRunResponse: {
          type: "object",
          properties: {
            createdCount: { type: "integer" },
            created: { type: "array", items: { $ref: "#/components/schemas/Commission" } }
          },
          required: ["createdCount", "created"]
        },
        Payment: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            totalAmount: { type: "number", example: 25000 },
            status: { type: "string", enum: ["PENDING", "PARTIALLY_PAID", "FULLY_PAID", "DISPUTED", "CANCELLED"], example: "PENDING" },
            createdAt: { type: "string", format: "date-time", example: "2026-05-02T09:30:00.000Z" }
          },
          required: ["id", "userId", "totalAmount", "status", "createdAt"]
        },
        PaymentTransaction: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            paymentId: { type: "string", format: "uuid" },
            amount: { type: "number", example: 10000 },
            method: { type: "string", enum: ["BANK_TRANSFER", "UPI", "CASH", "CARD", "OTHER"], example: "BANK_TRANSFER" },
            referenceNumber: { type: "string", nullable: true, example: "TXN-2026-0001" },
            proofUrl: { type: "string", format: "uri", nullable: true, example: "https://example.com/proofs/payment-proof-0001.pdf" },
            adminNote: { type: "string", nullable: true, example: "First installment released" },
            createdAt: { type: "string", format: "date-time", example: "2026-05-02T09:30:00.000Z" }
          },
          required: ["id", "paymentId", "amount", "method", "createdAt"]
        },
        PaymentCreateRequest: {
          type: "object",
          properties: {
            userId: { type: "string", format: "uuid", example: "7e23d6e8-8e0f-44fa-8ff1-3db8fca29d2f" },
            totalAmount: { type: "number", exclusiveMinimum: 0, example: 25000 },
            status: { type: "string", enum: ["PENDING", "DISPUTED", "CANCELLED"], example: "PENDING" }
          },
          required: ["userId", "totalAmount"],
          example: {
            userId: "7e23d6e8-8e0f-44fa-8ff1-3db8fca29d2f",
            totalAmount: 25000,
            status: "PENDING"
          }
        },
        PaymentCreateResponse: {
          allOf: [
            { $ref: "#/components/schemas/Payment" },
            { type: "object", properties: { effectiveStatus: { type: "string", enum: ["PENDING", "PARTIALLY_PAID", "FULLY_PAID", "DISPUTED", "CANCELLED"] } }, required: ["effectiveStatus"] }
          ]
        },
        PaymentTransactionCreateRequest: {
          type: "object",
          properties: {
            amount: { type: "number", exclusiveMinimum: 0 },
            method: { type: "string", enum: ["BANK_TRANSFER", "UPI", "CASH", "CARD", "OTHER"], example: "BANK_TRANSFER" },
            referenceNumber: { type: "string", example: "TXN-2026-0001" },
            proofUrl: { type: "string", format: "uri", example: "https://example.com/proofs/payment-proof-0001.pdf" },
            adminNote: { type: "string", example: "First installment released" }
          },
          required: ["amount", "method"],
          example: {
            amount: 10000,
            method: "BANK_TRANSFER",
            referenceNumber: "TXN-2026-0001",
            proofUrl: "https://example.com/proofs/payment-proof-0001.pdf",
            adminNote: "First installment released"
          }
        },
        PaymentTransactionCreateResponse: {
          type: "object",
          properties: {
            tx: { $ref: "#/components/schemas/PaymentTransaction" },
            payment: {
              allOf: [
                { $ref: "#/components/schemas/Payment" },
                { type: "object", properties: { transactions: { type: "array", items: { $ref: "#/components/schemas/PaymentTransaction" } }, effectiveStatus: { type: "string", enum: ["PENDING", "PARTIALLY_PAID", "FULLY_PAID", "DISPUTED", "CANCELLED"] } }, required: ["transactions", "effectiveStatus"] }
              ]
            }
          },
          required: ["tx", "payment"]
        },
        PaymentListItem: {
          allOf: [
            { $ref: "#/components/schemas/Payment" },
            {
              type: "object",
              properties: {
                transactions: { type: "array", items: { $ref: "#/components/schemas/PaymentTransaction" } },
                user: { $ref: "#/components/schemas/User" },
                effectiveStatus: { type: "string", enum: ["PENDING", "PARTIALLY_PAID", "FULLY_PAID", "DISPUTED", "CANCELLED"] }
              },
              required: ["transactions", "user", "effectiveStatus"]
            }
          ]
        },
        AuditLog: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            entityType: { type: "string" },
            entityId: { type: "string" },
            action: { type: "string", enum: ["CREATE", "UPDATE", "DELETE"] },
            oldValue: { type: "object", nullable: true, additionalProperties: true },
            newValue: { type: "object", nullable: true, additionalProperties: true },
            performedBy: { type: "string", format: "uuid" },
            timestamp: { type: "string", format: "date-time" }
          },
          required: ["id", "entityType", "entityId", "action", "performedBy", "timestamp"]
        },
        MonthlyEarningsItem: {
          type: "object",
          properties: {
            userId: { type: "string", format: "uuid" },
            type: { type: "string", enum: ["BASE", "BONUS"] },
            _sum: {
              type: "object",
              properties: { amount: { type: "number", nullable: true } },
              required: ["amount"]
            }
          },
          required: ["userId", "type", "_sum"]
        },
        ManagerNetworkPerformanceItem: {
          type: "object",
          properties: {
            managerId: { type: "string", format: "uuid" },
            managerName: { type: "string" },
            installations: { type: "integer" }
          },
          required: ["managerId", "managerName", "installations"]
        },
        PaymentsSummaryItem: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["PENDING", "PARTIALLY_PAID", "FULLY_PAID", "DISPUTED", "CANCELLED"] },
            _count: {
              type: "object",
              properties: { _all: { type: "integer" } },
              required: ["_all"]
            }
          },
          required: ["status", "_count"]
        },
        BonusSummaryItem: {
          type: "object",
          properties: {
            userId: { type: "string", format: "uuid" },
            _sum: {
              type: "object",
              properties: { amount: { type: "number", nullable: true } },
              required: ["amount"]
            },
            _count: {
              type: "object",
              properties: { _all: { type: "integer" } },
              required: ["_all"]
            }
          },
          required: ["userId", "_sum", "_count"]
        }
      }
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/health": {
        get: {
          tags: ["System"],
          summary: "Health check",
          security: [],
          responses: {
            "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } } }
          }
        }
      },
      "/users/login": {
        post: {
          tags: ["Users"],
          summary: "Login",
          security: [],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } }
          },
          responses: {
            "200": { description: "Token pair", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenPair" } } } },
            "401": { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            "423": { description: "Account locked", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginLockedResponse" } } } }
          }
        }
      },
      "/users/refresh": {
        post: {
          tags: ["Users"],
          summary: "Refresh token",
          security: [],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/RefreshTokenRequest" } } }
          },
          responses: {
            "200": { description: "New token pair", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenPair" } } } },
            "401": { description: "Invalid refresh token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
          }
        }
      },
      "/users/logout": {
        post: {
          tags: ["Users"],
          summary: "Logout",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/RefreshTokenRequest" } } }
          },
          responses: {
            "204": { description: "Logged out" },
            "400": { description: "Validation or request error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
          }
        }
      },
      "/users": {
        post: {
          tags: ["Users"],
          summary: "Create user",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/UserCreateRequest" } } }
          },
          responses: {
            "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            "403": { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
          }
        },
        get: {
          tags: ["Users"],
          summary: "List users",
          responses: {
            "200": { description: "List", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/UserWithHierarchy" } } } } },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
          }
        }
      },
      "/users/{id}": {
        patch: {
          tags: ["Users"],
          summary: "Update user",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid", example: "7e23d6e8-8e0f-44fa-8ff1-3db8fca29d2f" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/UserPatchRequest" } } }
          },
          responses: {
            "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            "403": { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
          }
        }
      },
      "/solutions": {
        post: {
          tags: ["Solutions"],
          summary: "Create solution",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/SolutionCreateRequest" } } }
          },
          responses: {
            "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Solution" } } } }
          }
        }
      },
      "/solutions/{id}/version": {
        post: {
          tags: ["Solutions"],
          summary: "Create version",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid", example: "2be591f8-4ff9-4dce-bb3d-9f863fddf5c5" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/SolutionVersionCreateRequest" } } }
          },
          responses: {
            "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/SolutionVersionCreateResponse" } } } }
          }
        }
      },
      "/solutions/{id}/versions": {
        get: {
          tags: ["Solutions"],
          summary: "List versions",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid", example: "2be591f8-4ff9-4dce-bb3d-9f863fddf5c5" } }],
          responses: {
            "200": { description: "List", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/SolutionVersion" } } } } }
          }
        }
      },
      "/contracts": {
        post: {
          tags: ["Contracts"],
          summary: "Create contract",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ContractCreateRequest" } } }
          },
          responses: {
            "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Contract" } } } }
          }
        },
        get: {
          tags: ["Contracts"],
          summary: "List contracts",
          responses: {
            "200": { description: "List", content: jsonContent }
          }
        }
      },
      "/commissions": {
        get: {
          tags: ["Commissions"],
          summary: "List commissions",
          responses: {
            "200": { description: "List", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Commission" } } } } }
          }
        }
      },
      "/commissions/{userId}": {
        get: {
          tags: ["Commissions"],
          summary: "List commissions by user",
          parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string", format: "uuid", example: "7e23d6e8-8e0f-44fa-8ff1-3db8fca29d2f" } }],
          responses: {
            "200": { description: "List", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Commission" } } } } }
          }
        }
      },
      "/bonuses/run-monthly": {
        post: {
          tags: ["Bonuses"],
          summary: "Run monthly bonuses",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/MonthlyBonusRunRequest" } } }
          },
          responses: {
            "200": { description: "Done", content: { "application/json": { schema: { $ref: "#/components/schemas/MonthlyBonusRunResponse" } } } }
          }
        }
      },
      "/payments": {
        post: {
          tags: ["Payments"],
          summary: "Create payment",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentCreateRequest" } } }
          },
          responses: {
            "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentCreateResponse" } } } }
          }
        },
        get: {
          tags: ["Payments"],
          summary: "List payments",
          responses: {
            "200": { description: "List", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/PaymentListItem" } } } } }
          }
        }
      },
      "/payments/{id}/transactions": {
        post: {
          tags: ["Payments"],
          summary: "Add payment transaction",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid", example: "4d3aa857-8b9f-4ed9-83b9-72d4f31a7780" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentTransactionCreateRequest" } } }
          },
          responses: {
            "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentTransactionCreateResponse" } } } }
          }
        }
      },
      "/audit-logs": {
        get: {
          tags: ["Audit"],
          summary: "List audit logs",
          responses: {
            "200": { description: "List", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/AuditLog" } } } } }
          }
        }
      },
      "/reports/monthly-earnings": {
        get: {
          tags: ["Reports"],
          summary: "Monthly earnings",
          parameters: [
            { name: "year", in: "query", required: true, schema: { type: "integer", minimum: 2000 } },
            { name: "month", in: "query", required: true, schema: { type: "integer", minimum: 1, maximum: 12 } }
          ],
          responses: {
            "200": { description: "Report", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/MonthlyEarningsItem" } } } } }
          }
        }
      },
      "/reports/manager-network-performance": {
        get: {
          tags: ["Reports"],
          summary: "Manager network performance",
          responses: {
            "200": { description: "Report", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/ManagerNetworkPerformanceItem" } } } } }
          }
        }
      },
      "/reports/payments-summary": {
        get: {
          tags: ["Reports"],
          summary: "Payments summary",
          responses: {
            "200": { description: "Report", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/PaymentsSummaryItem" } } } } }
          }
        }
      },
      "/reports/bonus-summary": {
        get: {
          tags: ["Reports"],
          summary: "Bonus summary",
          responses: {
            "200": { description: "Report", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/BonusSummaryItem" } } } } }
          }
        }
      }
    }
  },
  apis: []
};

export const openApiSpec = swaggerJsdoc(options);
