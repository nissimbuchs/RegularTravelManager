# Mission Statement

I would like to create a small web application that lets me manage regular travel allowances for my employees. I would like to brainstorm, on what features this application would need

## architecture

```mermaid
graph TB
 User[Employee/Manager] --> Web[Web App<br/>React + TypeScript]
 Web --> Edge[Vercel Edge Network]
 Edge --> API[Supabase API<br/>Auth + Database]
 API --> DB[(PostgreSQL<br/>Geographic Functions)]
 API --> RT[Real-time<br/>Notifications]
 RT --> Web
 Web --> GeoCalc[Distance Calculator<br/>Client-side]
 
 subgraph Supabase["Supabase Services"]
   API
   DB
   RT
   Auth[Authentication]
 end
 
 Auth --> Web
```

```mermaid
graph TB
      User[👤 Employee/Manager] --> CF[☁️ CloudFront CDN]
      CF --> S3[📦 S3 Static Hosting<br/>React App]

      S3 --> API[🚀 API Gateway<br/>REST API]
      API --> Lambda[⚡ Lambda Functions<br/>Node.js/TypeScript]

      Lambda --> RDS[(🗄️ RDS PostgreSQL<br/>PostGIS Extension)]
      Lambda --> Cognito[🔐 Amazon Cognito<br/>User Management]
      Lambda --> SES[📧 Simple Email Service<br/>Notifications]

      subgraph "AWS Services"
          CF
          S3
          API
          Lambda
          RDS
          Cognito
          SES
      end

      subgraph "Infrastructure as Code"
          CDK[📋 AWS CDK<br/>TypeScript]
      end

      CDK -.-> API
      CDK -.-> Lambda
      CDK -.-> RDS
      CDK -.-> Cognito
```
