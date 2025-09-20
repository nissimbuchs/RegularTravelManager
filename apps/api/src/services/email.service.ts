import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { logger } from '../middleware/logger';
import { isLocalDevelopment, isStaging } from '../config/environment';

export interface EmailConfig {
  fromAddress: string;
  replyToAddress: string;
  supportEmail: string;
  baseUrl: string;
  stagingAdminEmail?: string;
}

export class EmailService {
  private sesClient: SESClient;
  private config: EmailConfig;

  constructor() {
    this.sesClient = new SESClient({
      region: process.env.AWS_REGION || 'eu-central-1',
    });

    this.config = {
      fromAddress: process.env.FROM_EMAIL_ADDRESS || 'nissim@buchs.be',
      replyToAddress: process.env.REPLY_TO_EMAIL || 'nissim@buchs.be',
      supportEmail: process.env.SUPPORT_EMAIL || 'nissim@buchs.be',
      baseUrl: isLocalDevelopment()
        ? 'http://localhost:4200'
        : process.env.FRONTEND_BASE_URL || 'https://dz57qvo83kxos.cloudfront.net',
      stagingAdminEmail: process.env.STAGING_ADMIN_EMAIL || 'nissim@buchs.be',
    };
  }

  /**
   * Send email verification message
   */
  async sendVerificationEmail(
    email: string,
    firstName: string,
    verificationToken: string
  ): Promise<boolean> {
    try {
      const verificationUrl = `${this.config.baseUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

      // Mock email service for local development
      if (isLocalDevelopment() || process.env.MOCK_EMAIL === 'true') {
        logger.info('📧 MOCK EMAIL SERVICE - Verification Email', {
          email,
          firstName,
          verificationUrl,
          subject: 'Welcome to RegularTravelManager - Please Verify Your Email',
        });

        console.log('\n' + '='.repeat(80));
        console.log('📧 MOCK EMAIL SENT TO:', email);
        console.log('👤 RECIPIENT:', firstName);
        console.log('📋 SUBJECT: Welcome to RegularTravelManager - Please Verify Your Email');
        console.log('🔗 VERIFICATION URL:');
        console.log(verificationUrl);
        console.log('⏰ TOKEN EXPIRES: 24 hours');
        console.log('='.repeat(80) + '\n');

        return true;
      }

      // Staging email redirection - send to admin instead of user
      if (isStaging()) {
        const emailContent = this.generateStagingVerificationEmailContent(
          firstName,
          email,
          verificationUrl
        );

        const command = new SendEmailCommand({
          Source: this.config.fromAddress,
          ReplyToAddresses: [this.config.replyToAddress],
          Destination: {
            ToAddresses: [this.config.stagingAdminEmail!],
          },
          Message: {
            Subject: {
              Data: `[STAGING] Registration Verification for ${email}`,
              Charset: 'UTF-8',
            },
            Body: {
              Html: {
                Data: emailContent.html,
                Charset: 'UTF-8',
              },
              Text: {
                Data: emailContent.text,
                Charset: 'UTF-8',
              },
            },
          },
        });

        const result = await this.sesClient.send(command);

        logger.info('Staging verification email sent to admin', {
          originalEmail: email,
          adminEmail: this.config.stagingAdminEmail,
          messageId: result.MessageId,
          verificationUrl: verificationUrl.replace(verificationToken, '***'), // Don't log full token
        });

        return true;
      }

      // Production email sending via SES
      const emailContent = this.generateVerificationEmailContent(firstName, verificationUrl);

      const command = new SendEmailCommand({
        Source: this.config.fromAddress,
        ReplyToAddresses: [this.config.replyToAddress],
        Destination: {
          ToAddresses: [email],
        },
        Message: {
          Subject: {
            Data: 'Welcome to RegularTravelManager - Please Verify Your Email',
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: emailContent.html,
              Charset: 'UTF-8',
            },
            Text: {
              Data: emailContent.text,
              Charset: 'UTF-8',
            },
          },
        },
      });

      const result = await this.sesClient.send(command);

      logger.info('Verification email sent successfully', {
        email,
        messageId: result.MessageId,
        verificationUrl: verificationUrl.replace(verificationToken, '***'), // Don't log full token
      });

      return true;
    } catch (error) {
      logger.error('Failed to send verification email', {
        error: error.message,
        email,
      });
      return false;
    }
  }

  /**
   * Send registration welcome email after verification
   */
  async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    try {
      const loginUrl = `${this.config.baseUrl}/login`;

      // Mock email service for local development
      if (isLocalDevelopment() || process.env.MOCK_EMAIL === 'true') {
        logger.info('📧 MOCK EMAIL SERVICE - Welcome Email', {
          email,
          firstName,
          loginUrl,
          subject: 'Welcome to RegularTravelManager - Your Account is Ready!',
        });

        console.log('\n' + '='.repeat(80));
        console.log('🎉 MOCK WELCOME EMAIL SENT TO:', email);
        console.log('👤 RECIPIENT:', firstName);
        console.log('📋 SUBJECT: Welcome to RegularTravelManager - Your Account is Ready!');
        console.log('🔗 LOGIN URL:');
        console.log(loginUrl);
        console.log('✅ ACCOUNT STATUS: Verified and Active');
        console.log('='.repeat(80) + '\n');

        return true;
      }

      // Production email sending via SES
      const emailContent = this.generateWelcomeEmailContent(firstName, loginUrl);

      const command = new SendEmailCommand({
        Source: this.config.fromAddress,
        ReplyToAddresses: [this.config.replyToAddress],
        Destination: {
          ToAddresses: [email],
        },
        Message: {
          Subject: {
            Data: 'Welcome to RegularTravelManager - Your Account is Ready!',
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: emailContent.html,
              Charset: 'UTF-8',
            },
            Text: {
              Data: emailContent.text,
              Charset: 'UTF-8',
            },
          },
        },
      });

      const result = await this.sesClient.send(command);

      logger.info('Welcome email sent successfully', {
        email,
        messageId: result.MessageId,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send welcome email', {
        error: error.message,
        email,
      });
      return false;
    }
  }

  /**
   * Generate verification email content
   */
  private generateVerificationEmailContent(firstName: string, verificationUrl: string) {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification - RegularTravelManager</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #1976d2;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .verify-button {
            display: inline-block;
            background-color: #1976d2;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 14px;
          }
          .warning {
            background-color: #fff3cd;
            color: #856404;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            border: 1px solid #ffeaa7;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome to RegularTravelManager</h1>
          <p>Swiss Employee Travel Allowance Management</p>
        </div>
        
        <div class="content">
          <h2>Hello ${firstName}!</h2>
          
          <p>Thank you for registering with RegularTravelManager. To complete your account setup, please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="verify-button">Verify My Email Address</a>
          </div>
          
          <div class="warning">
            <strong>⏰ Important:</strong> This verification link will expire in 24 hours.
          </div>
          
          <p>If you can't click the button above, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #fff; padding: 10px; border-radius: 4px; font-family: monospace;">${verificationUrl}</p>
          
          <p>Once verified, you'll be able to:</p>
          <ul>
            <li>Submit travel allowance requests</li>
            <li>Track your request status</li>
            <li>Manage your profile and settings</li>
            <li>Access all RegularTravelManager features</li>
          </ul>
          
          <p>If you didn't create this account, you can safely ignore this email.</p>
          
          <p>Best regards,<br>
          The RegularTravelManager Team</p>
        </div>
        
        <div class="footer">
          <p>Need help? Contact us at <a href="mailto:${this.config.supportEmail}">${this.config.supportEmail}</a></p>
          <p>RegularTravelManager - Swiss Employee Travel Management</p>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to RegularTravelManager!
      
      Hello ${firstName}!
      
      Thank you for registering with RegularTravelManager. To complete your account setup, please verify your email address by visiting this link:
      
      ${verificationUrl}
      
      ⏰ IMPORTANT: This verification link will expire in 24 hours.
      
      Once verified, you'll be able to:
      - Submit travel allowance requests
      - Track your request status
      - Manage your profile and settings
      - Access all RegularTravelManager features
      
      If you didn't create this account, you can safely ignore this email.
      
      Best regards,
      The RegularTravelManager Team
      
      Need help? Contact us at ${this.config.supportEmail}
      RegularTravelManager - Swiss Employee Travel Management
    `;

    return { html, text };
  }

  /**
   * Generate welcome email content
   */
  private generateWelcomeEmailContent(firstName: string, loginUrl: string) {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Activated - RegularTravelManager</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #4caf50;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .login-button {
            display: inline-block;
            background-color: #1976d2;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 14px;
          }
          .success {
            background-color: #d4edda;
            color: #155724;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            border: 1px solid #c3e6cb;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>✅ Account Activated!</h1>
          <p>You're ready to use RegularTravelManager</p>
        </div>
        
        <div class="content">
          <h2>Welcome aboard, ${firstName}!</h2>
          
          <div class="success">
            <strong>🎉 Success!</strong> Your email has been verified and your account is now active.
          </div>
          
          <p>You can now log in to your RegularTravelManager account and start managing your travel allowances.</p>
          
          <div style="text-align: center;">
            <a href="${loginUrl}" class="login-button">Log In to Your Account</a>
          </div>
          
          <h3>What you can do now:</h3>
          <ul>
            <li><strong>Submit Travel Requests:</strong> Create new travel allowance requests with automatic distance calculations</li>
            <li><strong>Track Status:</strong> Monitor your requests through the approval process</li>
            <li><strong>Manage Profile:</strong> Update your home address and personal information</li>
            <li><strong>View History:</strong> Access your complete travel request history</li>
          </ul>
          
          <h3>Getting Started:</h3>
          <ol>
            <li>Log in using your email and the password you created</li>
            <li>Complete your profile with your current home address</li>
            <li>Submit your first travel allowance request</li>
          </ol>
          
          <p>If you have any questions or need assistance, don't hesitate to reach out to our support team.</p>
          
          <p>Best regards,<br>
          The RegularTravelManager Team</p>
        </div>
        
        <div class="footer">
          <p>Need help? Contact us at <a href="mailto:${this.config.supportEmail}">${this.config.supportEmail}</a></p>
          <p>RegularTravelManager - Swiss Employee Travel Management</p>
        </div>
      </body>
      </html>
    `;

    const text = `
      Account Activated - RegularTravelManager
      
      Welcome aboard, ${firstName}!
      
      🎉 SUCCESS! Your email has been verified and your account is now active.
      
      You can now log in to your RegularTravelManager account and start managing your travel allowances.
      
      Log in here: ${loginUrl}
      
      What you can do now:
      - Submit Travel Requests: Create new travel allowance requests with automatic distance calculations
      - Track Status: Monitor your requests through the approval process  
      - Manage Profile: Update your home address and personal information
      - View History: Access your complete travel request history
      
      Getting Started:
      1. Log in using your email and the password you created
      2. Complete your profile with your current home address
      3. Submit your first travel allowance request
      
      If you have any questions or need assistance, don't hesitate to reach out to our support team.
      
      Best regards,
      The RegularTravelManager Team
      
      Need help? Contact us at ${this.config.supportEmail}
      RegularTravelManager - Swiss Employee Travel Management
    `;

    return { html, text };
  }

  /**
   * Generate staging verification email content for admin
   */
  private generateStagingVerificationEmailContent(
    firstName: string,
    originalEmail: string,
    verificationUrl: string
  ) {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>[STAGING] Registration Verification - RegularTravelManager</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #ff9800;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .verify-button {
            display: inline-block;
            background-color: #1976d2;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: bold;
          }
          .user-details {
            background-color: #fff3e0;
            border: 1px solid #ff9800;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 14px;
          }
          .warning {
            background-color: #fff3cd;
            color: #856404;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            border: 1px solid #ffeaa7;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🧪 STAGING ENVIRONMENT</h1>
          <p>Registration Verification Required</p>
        </div>

        <div class="content">
          <h2>Hello Admin!</h2>

          <p>A new user has registered in the staging environment and requires account verification.</p>

          <div class="user-details">
            <h3>User Registration Details:</h3>
            <ul>
              <li><strong>Name:</strong> ${firstName}</li>
              <li><strong>Email:</strong> ${originalEmail}</li>
              <li><strong>Environment:</strong> Staging</li>
            </ul>
          </div>

          <p><strong>Action Required:</strong> Click the verification button below to activate this user's account on their behalf.</p>

          <div style="text-align: center;">
            <a href="${verificationUrl}" class="verify-button">✅ Verify User Account</a>
          </div>

          <div class="warning">
            <strong>⚠️ Staging Notice:</strong> This email was redirected to you because we're in staging environment. The user expects their account to be verified and will not receive this email directly.
          </div>

          <p>After verification, the user will be able to log in with:</p>
          <ul>
            <li><strong>Email:</strong> ${originalEmail}</li>
            <li><strong>Password:</strong> [The password they created during registration]</li>
          </ul>

          <p>If you can't click the button above, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #fff; padding: 10px; border-radius: 4px; font-family: monospace;">${verificationUrl}</p>

          <p>Best regards,<br>
          The RegularTravelManager System</p>
        </div>

        <div class="footer">
          <p>This is an automated staging environment notification</p>
          <p>RegularTravelManager - Swiss Employee Travel Management</p>
        </div>
      </body>
      </html>
    `;

    const text = `
      [STAGING ENVIRONMENT] Registration Verification Required

      Hello Admin!

      A new user has registered in the staging environment and requires account verification.

      USER REGISTRATION DETAILS:
      - Name: ${firstName}
      - Email: ${originalEmail}
      - Environment: Staging

      ACTION REQUIRED:
      Visit the following link to activate this user's account on their behalf:

      ${verificationUrl}

      ⚠️ STAGING NOTICE:
      This email was redirected to you because we're in staging environment.
      The user expects their account to be verified and will not receive this email directly.

      After verification, the user will be able to log in with:
      - Email: ${originalEmail}
      - Password: [The password they created during registration]

      Best regards,
      The RegularTravelManager System

      This is an automated staging environment notification
      RegularTravelManager - Swiss Employee Travel Management
    `;

    return { html, text };
  }
}
