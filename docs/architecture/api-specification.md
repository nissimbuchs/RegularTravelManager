# API Specification

Based on the REST API style from our tech stack and the core workflows identified in brainstorming, here's the complete OpenAPI specification for RegularTravelManager:

```yaml
openapi: 3.0.0
info:
  title: RegularTravelManager API
  version: 1.0.0
  description: REST API for managing employee travel allowance requests and approvals
servers:
  - url: https://api.regulartravelmanager.com/v1
    description: Production API
    
components:
  securitySchemes:
    CognitoAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      
  schemas:
    TravelRequest:
      type: object
      required: [employeeId, managerId, projectId, subProjectId, daysPerWeek, justification]
      properties:
        id:
          type: string
          format: uuid
        employeeId:
          type: string
          format: uuid
        managerId:
          type: string
          format: uuid
        projectId:
          type: string
          format: uuid
        subProjectId:
          type: string
          format: uuid
        daysPerWeek:
          type: integer
          minimum: 1
          maximum: 7
        justification:
          type: string
          minLength: 10
          maxLength: 500
        status:
          type: string
          enum: [pending, approved, rejected, withdrawn]
        calculatedDistance:
          type: number
          format: float
        calculatedAllowance:
          type: number
          format: float
        submittedAt:
          type: string
          format: date-time
        processedAt:
          type: string
          format: date-time
          nullable: true
        processedBy:
          type: string
          format: uuid
          nullable: true
        rejectionReason:
          type: string
          nullable: true

security:
  - CognitoAuth: []

paths:
  /travel-requests:
    post:
      summary: Submit a new travel request
      tags: [Travel Requests]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [managerId, projectId, subProjectId, daysPerWeek, justification]
              properties:
                managerId:
                  type: string
                  format: uuid
                projectId:
                  type: string
                  format: uuid
                subProjectId:
                  type: string
                  format: uuid
                daysPerWeek:
                  type: integer
                  minimum: 1
                  maximum: 7
                justification:
                  type: string
                  minLength: 10
                  maxLength: 500
      responses:
        '201':
          description: Travel request created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TravelRequest'
                
  /manager/requests:
    get:
      summary: Get requests for manager approval
      tags: [Manager]
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, approved, rejected]
            default: pending
      responses:
        '200':
          description: List of requests for approval
          content:
            application/json:
              schema:
                type: object
                properties:
                  requests:
                    type: array
                    items:
                      $ref: '#/components/schemas/TravelRequest'
```
