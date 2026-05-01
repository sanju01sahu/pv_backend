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
            email: { type: "string", format: "email" },
            password: { type: "string" }
          },
          required: ["email", "password"]
        },
        RefreshTokenRequest: {
          type: "object",
          properties: { refreshToken: { type: "string" } },
          required: ["refreshToken"]
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
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["ADMIN", "AREA_MANAGER", "AGENT"] },
            managerId: { type: "string", format: "uuid", nullable: true },
            createdAt: { type: "string", format: "date-time" }
          },
          required: ["id", "name", "email", "role", "createdAt"]
        },
        UserCreateRequest: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 2 },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 12, description: "Must include uppercase, lowercase, number, and special character" },
            role: { type: "string", enum: ["ADMIN", "AREA_MANAGER", "AGENT"] },
            managerId: { type: "string", format: "uuid" }
          },
          required: ["name", "email", "password", "role"]
        },
        UserPatchRequest: {
          type: "object",
          properties: {
            name: { type: "string" },
            managerId: { type: "string", format: "uuid", nullable: true }
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
            name: { type: "string" },
            createdAt: { type: "string", format: "date-time" }
          },
          required: ["id", "name", "createdAt"]
        },
        SolutionCreateRequest: {
          type: "object",
          properties: { name: { type: "string", minLength: 1 } },
          required: ["name"]
        },
        SolutionVersion: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            solutionId: { type: "string", format: "uuid" },
            price: { type: "number" },
            baseCommission: { type: "number" },
            validFrom: { type: "string", format: "date-time" },
            validTo: { type: "string", format: "date-time", nullable: true },
            createdBy: { type: "string", format: "uuid" },
            createdAt: { type: "string", format: "date-time" }
          },
          required: ["id", "solutionId", "price", "baseCommission", "validFrom", "createdBy", "createdAt"]
        },
        SolutionVersionCreateRequest: {
          type: "object",
          properties: {
            price: { type: "number", exclusiveMinimum: 0 },
            baseCommission: { type: "number", minimum: 0 },
            validFrom: { type: "string", format: "date-time" },
            validTo: { type: "string", format: "date-time" },
            retroactive: { type: "boolean", default: false }
          },
          required: ["price", "baseCommission", "validFrom"]
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
            customerDetails: { type: "object", additionalProperties: true },
            installationDate: { type: "string", format: "date-time" },
            status: { type: "string", enum: ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"] },
            createdAt: { type: "string", format: "date-time" }
          },
          required: ["id", "agentId", "solutionVersionId", "customerDetails", "installationDate", "status", "createdAt"]
        },
        ContractCreateRequest: {
          type: "object",
          properties: {
            solutionId: { type: "string", format: "uuid" },
            customerDetails: { type: "object", additionalProperties: true },
            installationDate: { type: "string", format: "date-time" },
            status: { type: "string", enum: ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"], default: "ACTIVE" },
            agentId: { type: "string", format: "uuid", description: "Required for non-AGENT callers" }
          },
          required: ["solutionId", "customerDetails", "installationDate"]
        },
        Commission: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            contractId: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            amount: { type: "number" },
            type: { type: "string", enum: ["BASE", "BONUS"] },
            createdAt: { type: "string", format: "date-time" }
          },
          required: ["id", "contractId", "userId", "amount", "type", "createdAt"]
        },
        MonthlyBonusRunRequest: {
          type: "object",
          properties: {
            year: { type: "integer", minimum: 2000 },
            month: { type: "integer", minimum: 1, maximum: 12 }
          },
          required: ["year", "month"]
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
            totalAmount: { type: "number" },
            status: { type: "string", enum: ["PENDING", "PARTIALLY_PAID", "FULLY_PAID", "DISPUTED", "CANCELLED"] },
            createdAt: { type: "string", format: "date-time" }
          },
          required: ["id", "userId", "totalAmount", "status", "createdAt"]
        },
        PaymentTransaction: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            paymentId: { type: "string", format: "uuid" },
            amount: { type: "number" },
            method: { type: "string", enum: ["BANK_TRANSFER", "UPI", "CASH", "CARD", "OTHER"] },
            referenceNumber: { type: "string", nullable: true },
            proofUrl: { type: "string", format: "uri", nullable: true },
            adminNote: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" }
          },
          required: ["id", "paymentId", "amount", "method", "createdAt"]
        },
        PaymentCreateRequest: {
          type: "object",
          properties: {
            userId: { type: "string", format: "uuid" },
            totalAmount: { type: "number", exclusiveMinimum: 0 },
            status: { type: "string", enum: ["PENDING", "DISPUTED", "CANCELLED"] }
          },
          required: ["userId", "totalAmount"]
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
            method: { type: "string", enum: ["BANK_TRANSFER", "UPI", "CASH", "CARD", "OTHER"] },
            referenceNumber: { type: "string" },
            proofUrl: { type: "string", format: "uri" },
            adminNote: { type: "string" }
          },
          required: ["amount", "method"]
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
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
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
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
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
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
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
          parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
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
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
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
