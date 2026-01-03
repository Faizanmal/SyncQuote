# SyncQuote - Production Deployment Guide

This guide covers deploying SyncQuote to production AWS infrastructure.

## Prerequisites

- ✅ AWS Account with billing enabled
- ✅ AWS CLI installed and configured
- ✅ Terraform installed (v1.5+)
- ✅ Docker installed
- ✅ GitHub repository with Actions enabled
- ✅ Vercel account
- ✅ Domain name (e.g., syncquote.com)

## Architecture Overview

```
┌─────────────┐
│   Route53   │  DNS
└──────┬──────┘
       │
       ├──────────────┐
       │              │
┌──────▼──────┐  ┌───▼────────┐
│   Vercel    │  │  CloudFront │
│  (Frontend) │  │   + ALB     │
└─────────────┘  └───┬─────────┘
                     │
                ┌────▼─────┐
                │   ECS    │
                │ Fargate  │
                │(Backend) │
                └────┬─────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼───┐   ┌───▼────┐  ┌───▼────┐
   │  RDS   │   │ Redis  │  │   S3   │
   │Postgres│   │ElastiC.│  │ Assets │
   └────────┘   └────────┘  └────────┘
```

## Phase 1: Infrastructure Setup (Terraform)

### Step 1: Configure AWS CLI
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: us-east-1
# Default output format: json
```

### Step 2: Create S3 Bucket for Terraform State
```bash
# Create state bucket
aws s3api create-bucket \
  --bucket syncquote-terraform-state \
  --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket syncquote-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### Step 3: Initialize Terraform
```bash
cd terraform

# Create production variables file
cat > production.tfvars <<EOF
environment = "production"
aws_region = "us-east-1"
db_instance_class = "db.t4g.small"
db_name = "syncquote"
db_username = "syncquote_admin"
db_password = "CHANGE-THIS-SECURE-PASSWORD"
EOF

# Initialize Terraform
terraform init

# Review plan
terraform plan -var-file="production.tfvars"

# Apply infrastructure (this will take 10-15 minutes)
terraform apply -var-file="production.tfvars"
```

### Step 4: Save Terraform Outputs
```bash
# Get RDS endpoint
terraform output rds_endpoint

# Get Redis endpoint
terraform output redis_endpoint

# Get S3 bucket name
terraform output s3_bucket_name

# Get ECR repository URL
terraform output ecr_repository_url
```

## Phase 2: Secrets Management

### Setup AWS Secrets Manager
```bash
# Create secrets for backend
aws secretsmanager create-secret \
  --name syncquote/production/backend \
  --description "SyncQuote backend environment variables" \
  --secret-string '{
    "DATABASE_URL": "postgresql://syncquote_admin:PASSWORD@your-rds-endpoint:5432/syncquote",
    "JWT_ACCESS_SECRET": "GENERATE-SECURE-RANDOM-STRING",
    "JWT_REFRESH_SECRET": "GENERATE-ANOTHER-SECURE-RANDOM-STRING",
    "STRIPE_SECRET_KEY": "sk_live_your-stripe-key",
    "SENDGRID_API_KEY": "SG.your-sendgrid-key",
    "GOOGLE_CLIENT_ID": "your-google-client-id",
    "GOOGLE_CLIENT_SECRET": "your-google-client-secret",
    "SENTRY_DSN": "https://your-sentry-dsn"
  }'
```

## Phase 3: Backend Deployment

### Step 1: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (e.g., us-east-1)

### Step 2: Build and Push Docker Image

```bash
cd backend-nestjs

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t syncquote-backend .

# Tag image
docker tag syncquote-backend:latest \
  <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/syncquote-backend:latest

# Push to ECR
docker push <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/syncquote-backend:latest
```

### Step 3: Create ECS Task Definition

Create `task-definition.json`:
```json
{
  "family": "syncquote-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "<ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/syncquote-backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3001"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<ACCOUNT_ID>:secret:syncquote/production/backend:DATABASE_URL::"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/syncquote-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

Register task definition:
```bash
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json
```

### Step 4: Create ECS Service

```bash
aws ecs create-service \
  --cluster syncquote-production \
  --service-name backend-service \
  --task-definition syncquote-backend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

### Step 5: Run Database Migrations

```bash
# SSH into ECS task or run migration task
aws ecs run-task \
  --cluster syncquote-production \
  --task-definition syncquote-backend \
  --launch-type FARGATE \
  --overrides '{
    "containerOverrides": [{
      "name": "backend",
      "command": ["npx", "prisma", "migrate", "deploy"]
    }]
  }'
```

## Phase 4: Frontend Deployment (Vercel)

### Step 1: Install Vercel CLI
```bash
npm i -g vercel
```

### Step 2: Link Project
```bash
cd frontend
vercel link
```

### Step 3: Configure Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add:
- `NEXT_PUBLIC_API_URL` = `https://api.syncquote.com/api/v1`
- `NEXT_PUBLIC_WS_URL` = `wss://api.syncquote.com`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_...`
- `NEXT_PUBLIC_SENTRY_DSN` = `https://...`

### Step 4: Deploy
```bash
vercel --prod
```

### Step 5: Configure Custom Domain

In Vercel Dashboard:
1. Go to Settings → Domains
2. Add domain: `syncquote.com` and `www.syncquote.com`
3. Follow DNS configuration instructions

## Phase 5: DNS Configuration

### Route53 Setup
```bash
# Create hosted zone (if not exists)
aws route53 create-hosted-zone \
  --name syncquote.com \
  --caller-reference $(date +%s)

# Add A record for API (pointing to ALB)
# Add CNAME for www (pointing to Vercel)
```

Example DNS records:
```
syncquote.com        A      -> Vercel IP
www.syncquote.com    CNAME  -> cname.vercel-dns.com
api.syncquote.com    CNAME  -> your-alb.us-east-1.elb.amazonaws.com
```

## Phase 6: SSL/TLS Certificates

### For Backend (AWS ACM)
```bash
# Request certificate
aws acm request-certificate \
  --domain-name api.syncquote.com \
  --validation-method DNS \
  --region us-east-1

# Validate using DNS (add CNAME records shown in ACM)
```

### For Frontend
Vercel automatically provisions SSL certificates for custom domains.

## Phase 7: Monitoring & Alerts

### CloudWatch Alarms
```bash
# CPU utilization alarm
aws cloudwatch put-metric-alarm \
  --alarm-name syncquote-high-cpu \
  --alarm-description "Alert when CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

### UptimeRobot Setup
1. Sign up at https://uptimerobot.com/
2. Add monitor:
   - Type: HTTPS
   - URL: https://api.syncquote.com/api/v1/health
   - Interval: 5 minutes

### Sentry Setup
1. Create project at https://sentry.io/
2. Copy DSN to environment variables (already done)
3. Test error tracking

## Phase 8: Post-Deployment Checklist

### Verify Deployment
- [ ] Backend health check: `https://api.syncquote.com/api/v1/health`
- [ ] API docs accessible: `https://api.syncquote.com/api/docs`
- [ ] Frontend loads: `https://syncquote.com`
- [ ] Can sign up a new user
- [ ] Can sign in
- [ ] Can create a proposal
- [ ] WebSocket connection works
- [ ] Email notifications sent
- [ ] Stripe webhooks received

### Performance
- [ ] Backend response time < 200ms
- [ ] Frontend LCP < 2.5s
- [ ] Database connections pooled correctly
- [ ] Redis caching working

### Security
- [ ] HTTPS enforced (no HTTP access)
- [ ] Security headers present (use securityheaders.com)
- [ ] Rate limiting active
- [ ] CORS configured correctly
- [ ] No secrets in frontend bundle
- [ ] Database accessible only from VPC

### Monitoring
- [ ] Sentry receiving events
- [ ] CloudWatch logs visible
- [ ] UptimeRobot monitoring active
- [ ] CloudWatch alarms configured

## Rollback Procedure

If deployment fails:

```bash
# Backend - Revert to previous task definition
aws ecs update-service \
  --cluster syncquote-production \
  --service backend-service \
  --task-definition syncquote-backend:<PREVIOUS_VERSION>

# Frontend - Revert in Vercel
vercel rollback
```

## Scaling Configuration

### Backend Auto-Scaling
```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/syncquote-production/backend-service \
  --min-capacity 2 \
  --max-capacity 10

# Create scaling policy
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/syncquote-production/backend-service \
  --policy-name cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

## Cost Estimation (Monthly)

- **ECS Fargate** (2 tasks): ~$30
- **RDS PostgreSQL** (db.t4g.small): ~$30
- **ElastiCache Redis** (cache.t4g.micro): ~$15
- **S3 Storage** (100GB): ~$2
- **CloudWatch Logs**: ~$5
- **Data Transfer**: ~$10
- **Vercel Pro**: $20
- **Total**: ~$112/month

## Maintenance

### Database Backups
- Automated daily backups (7-day retention) configured in Terraform
- Test restore procedure quarterly

### Updates
- Monitor dependencies with Dependabot
- Apply security patches within 48 hours
- Test in staging before production

### Logs Retention
- CloudWatch logs: 30 days
- S3 access logs: 90 days
- Application logs: 30 days

## Support & Troubleshooting

### Check Service Health
```bash
# ECS service status
aws ecs describe-services \
  --cluster syncquote-production \
  --services backend-service

# View logs
aws logs tail /ecs/syncquote-backend --follow
```

### Common Issues
1. **Service won't start**: Check task logs in CloudWatch
2. **High CPU usage**: Review slow queries, add caching
3. **Memory issues**: Increase task memory or add Redis
4. **Database connection errors**: Check security groups and RDS status

---

**Deployment Complete!** 🎉

Your production SyncQuote instance is now live at `https://syncquote.com`
