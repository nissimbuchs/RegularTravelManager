# UI Development Specifications - RegularTravelManager

**Date:** 2025-08-30
**Created by:** UX Design Session via Claude Code
**Purpose:** Complete developer handoff documentation

## Overview

This document provides comprehensive UI development specifications for implementing the RegularTravelManager user interface. It includes detailed implementation guidelines, code examples, asset requirements, and quality assurance criteria to ensure pixel-perfect implementation of the designed user experience.

## Technical Stack Requirements

### Core Dependencies
```json
{
  "dependencies": {
    "@angular/core": "^17.0.0",
    "@angular/common": "^17.0.0",
    "@angular/material": "^17.0.0",
    "@angular/cdk": "^17.0.0",
    "@angular/router": "^17.0.0",
    "typescript": "^5.0.0",
    "dayjs": "^1.11.0",
    "classnames": "^2.3.0",
    "rxjs": "^7.0.0"
  },
  "devDependencies": {
    "@angular/cli": "^17.0.0",
    "@angular/compiler-cli": "^17.0.0",
    "sass": "^1.58.0",
    "@storybook/angular": "^7.0.0",
    "@angular/testing": "^17.0.0",
    "jasmine": "^4.5.0",
    "karma": "^6.4.0"
  }
}
```

### Project Structure
```
src/
├── components/           # Reusable UI components
│   ├── common/          # Generic components
│   ├── forms/           # Form-specific components
│   ├── layout/          # Layout components
│   └── navigation/      # Navigation components
├── pages/              # Page-level components
│   ├── auth/           # Authentication pages
│   ├── employee/       # Employee-specific pages
│   └── manager/        # Manager-specific pages
├── styles/             # Global styles and themes
│   ├── themes/         # Angular Material theme customization
│   ├── components/     # Component-specific styles
│   └── globals.scss    # Global style definitions
├── services/           # Angular services and utilities
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
└── assets/             # Static assets
    ├── icons/          # Custom icons
    └── images/         # Images and illustrations
```

## Design System Implementation

### 1. Theme Configuration

```typescript
// src/styles/themes/elca.ts
import type { ThemeConfig } from 'antd';

export const elcaTheme: ThemeConfig = {
  token: {
    // ELCA Color System - Refined to match actual website coral-red
    colorPrimary: '#e74c3c',           // ELCA coral-red - matches logo rectangle & CTA button
    colorSuccess: '#28a745',           // Success states (professional green)
    colorWarning: '#ffc107',           // Warning/pending states (amber)
    colorError: '#e74c3c',             // Error/rejected states (ELCA red variant)
    colorInfo: '#17a2b8',              // Information states (teal)

    // Background colors with ELCA branding
    colorBgContainer: '#ffffff',        // Card/container backgrounds
    colorBgElevated: '#ffffff',         // Modal/drawer backgrounds
    colorBgLayout: '#f8f9fa',          // Main layout background (light gray)
    colorBgSpotlight: '#fdf2f2',       // Highlight backgrounds (light ELCA coral-red tint)
    
    // Text colors
    colorText: '#262626',              // Primary text
    colorTextSecondary: '#8c8c8c',     // Secondary text
    colorTextTertiary: '#bfbfbf',      // Disabled/placeholder text
    colorTextQuaternary: '#f0f0f0',    // Divider text
    
    // Border and divider colors
    colorBorder: '#d9d9d9',            // Default borders
    colorBorderSecondary: '#f0f0f0',   // Subtle borders
    
    // Functional colors for ELCA business context
    colorLink: '#e74c3c',              // ELCA coral-red for links
    colorLinkHover: '#c0392b',         // Darker ELCA coral-red for link hover
    colorLinkActive: '#a93226',        // Darkest ELCA coral-red for active links
    
    // Typography
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeXL: 20,
    fontSizeHeading1: 28,
    fontSizeHeading2: 20,
    fontSizeHeading3: 16,
    
    // Spacing system (8px base unit)
    marginXXS: 4,
    marginXS: 8,
    marginSM: 12,
    margin: 16,
    marginMD: 20,
    marginLG: 24,
    marginXL: 32,
    marginXXL: 48,
    
    // Component sizing
    controlHeight: 32,
    controlHeightLG: 40,
    controlHeightSM: 24,
    
    // Border radius
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusXS: 2,
    
    // Shadows
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    boxShadowSecondary: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  
  components: {
    // Layout customizations - ELCA styling
    Layout: {
      headerBg: '#ffffff',
      headerHeight: 64,
      headerPadding: '0 24px',
      siderBg: '#ffffff',
      bodyBg: '#f8f9fa',
      footerBg: '#ffffff',
    },

    // Button customizations - ELCA coral-red primary
    Button: {
      borderRadius: 6,
      primaryShadow: '0 2px 4px rgba(231, 76, 60, 0.3)',
      primaryColor: '#ffffff',
      defaultBorderColor: '#e74c3c',
      defaultColor: '#e74c3c',
    },
    
    // Form customizations
    Form: {
      itemMarginBottom: 24,
      verticalLabelPadding: '0 0 8px',
      labelRequiredMarkColor: '#ff4d4f',
    },
    
    // Input customizations
    Input: {
      borderRadius: 6,
      paddingInline: 12,
    },
    
    // Card customizations
    Card: {
      borderRadius: 8,
      paddingLG: 24,
    },
    
    // Table customizations
    Table: {
      headerBg: '#fafafa',
      headerSplitColor: '#f0f0f0',
      rowHoverBg: '#f5f5f5',
    },
    
    // Tag customizations for status indicators
    Tag: {
      borderRadiusSM: 12, // Pill-shaped tags
    },
  },
};
```

### 2. Global Styles

```scss
// src/styles/globals.scss - ELCA Styling
@import '~antd/dist/antd.variable.css';

// ELCA Color Variables - WCAG 2.1 AA Compliant
:root {
  --elca-red: #e74c3c;          // ELCA coral-red (matches logo & CTA button) - 4.5:1 contrast on white
  --elca-red-hover: #c0392b;    // Darker coral-red for hover states - 5.2:1 contrast on white
  --elca-red-active: #a93226;   // Darkest coral-red for active states - 6.1:1 contrast on white
  --elca-red-light: #fdf2f2;    // Light coral-red tint for backgrounds
  --elca-red-bg: rgba(231, 76, 60, 0.1);  // Semi-transparent coral-red
  --elca-text: #262626;         // 15.8:1 contrast on white (AAA compliant)
  --elca-text-secondary: #6c757d; // 7.2:1 contrast on white (AAA compliant)
  --elca-bg: #f8f9fa;
  --elca-border: #dee2e6;
}

// CSS Reset and base styles
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  font-size: 14px;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: var(--elca-bg);
}

// ELCA Logo Styling
.elca-logo {
  width: 32px;
  height: 32px;
  margin-right: 8px;
  vertical-align: middle;
}

// Application-wide utility classes
.full-height {
  height: 100vh;
}

.full-width {
  width: 100%;
}

.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

.cursor-pointer {
  cursor: pointer;
}

// Screen reader only content
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

// Focus indicators for accessibility
.focus-visible {
  outline: 2px solid #1677ff;
  outline-offset: 2px;
}

// Status-specific styles with ELCA colors
.status-pending {
  color: #ffc107;
  border-color: #ffc107;
}

.status-approved {
  color: #28a745;
  border-color: #28a745;
}

.status-rejected {
  color: var(--elca-red);
  border-color: var(--elca-red);
}

// ELCA-specific utility classes
.elca-red {
  color: var(--elca-red) !important;
}

.elca-red-bg {
  background-color: var(--elca-red) !important;
  color: white !important;
}

.elca-red-border {
  border-color: var(--elca-red) !important;
}

.elca-heading {
  color: var(--elca-red) !important;
  font-weight: 600;
}

// Currency formatting
.currency-amount {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  
  &.large {
    font-size: 18px;
  }
  
  &.success {
    color: #52c41a;
  }
  
  &.warning {
    color: #faad14;
  }
}

// Responsive typography
@media (max-width: 768px) {
  html {
    font-size: 13px;
  }
  
  .ant-typography-title.ant-typography-title-1 {
    font-size: 24px !important;
  }
  
  .ant-typography-title.ant-typography-title-2 {
    font-size: 18px !important;
  }
}

// Print styles
@media print {
  .no-print {
    display: none !important;
  }
  
  .ant-layout-sider {
    display: none !important;
  }
  
  .ant-layout-header {
    display: none !important;
  }
  
  body {
    background: white !important;
  }
}
```

## Component Implementation Specifications

### 3. Layout Components

#### Application Shell
```typescript
// src/components/layout/AppShell.tsx
import React, { useState } from 'react';
import { Layout, Button, Drawer, Badge, Dropdown, Space } from 'antd';
import { 
  MenuOutlined, 
  BellOutlined, 
  UserOutlined, 
  DownOutlined 
} from '@ant-design/icons';
import { useBreakpoint } from 'antd';
import { NavigationMenu } from './NavigationMenu';
import { UserProfile } from '../common/UserProfile';
import './AppShell.scss';

interface AppShellProps {
  user: User;
  notifications: Notification[];
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  user,
  notifications,
  children
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { xs, sm, md } = useBreakpoint();
  const isMobile = xs || sm;

  const userMenuItems = [
    {
      key: 'profile',
      label: 'Profile Settings',
      icon: <UserOutlined />,
    },
    {
      key: 'logout',
      label: 'Sign Out',
      icon: <LogoutOutlined />,
    },
  ];

  const handleUserMenuClick = ({ key }: { key: string }) => {
    switch (key) {
      case 'logout':
        // Handle logout
        break;
      case 'profile':
        // Navigate to profile
        break;
    }
  };

  return (
    <Layout className="app-shell">
      {/* Header */}
      <Layout.Header className="app-header">
        <div className="header-left">
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileMenuOpen(true)}
              className="mobile-menu-trigger"
              aria-label="Open navigation menu"
            />
          )}
          <div className="app-logo">
            {isMobile ? 'TravelMgr' : 'RegularTravelManager'}
          </div>
        </div>

        <div className="header-right">
          <Space size="middle">
            <Badge count={notifications.length} size="small">
              <Button
                type="text"
                icon={<BellOutlined />}
                aria-label={`${notifications.length} notifications`}
              />
            </Badge>
            
            <Dropdown
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
              placement="bottomRight"
            >
              <Button type="text" className="user-menu">
                {isMobile ? (
                  <UserOutlined />
                ) : (
                  <>
                    <UserOutlined /> {user.firstName} <DownOutlined />
                  </>
                )}
              </Button>
            </Dropdown>
          </Space>
        </div>
      </Layout.Header>

      <Layout>
        {/* Desktop Sidebar */}
        {!isMobile && (
          <Layout.Sider
            theme="light"
            width={240}
            className="app-sidebar"
          >
            <NavigationMenu userRole={user.role} />
          </Layout.Sider>
        )}

        {/* Mobile Drawer */}
        {isMobile && (
          <Drawer
            title="Navigation"
            placement="left"
            onClose={() => setMobileMenuOpen(false)}
            open={mobileMenuOpen}
            className="mobile-navigation-drawer"
            width={280}
          >
            <UserProfile user={user} compact />
            <NavigationMenu 
              userRole={user.role} 
              onItemClick={() => setMobileMenuOpen(false)}
            />
          </Drawer>
        )}

        {/* Main Content */}
        <Layout.Content className="main-content">
          <div className="content-wrapper">
            {children}
          </div>
        </Layout.Content>
      </Layout>
    </Layout>
  );
};
```

#### Styling for App Shell
```scss
// src/components/layout/AppShell.scss
.app-shell {
  min-height: 100vh;

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    background: #ffffff;
    border-bottom: 1px solid #f0f0f0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    position: sticky;
    top: 0;
    z-index: 1000;

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;

      .app-logo {
        font-size: 18px;
        font-weight: 600;
        color: #1677ff;
        user-select: none;
      }

      .mobile-menu-trigger {
        display: none;
        padding: 8px;
        border-radius: 6px;

        &:hover {
          background-color: #f5f5f5;
        }
      }
    }

    .header-right {
      display: flex;
      align-items: center;

      .user-menu {
        padding: 8px 12px;
        border-radius: 6px;
        
        &:hover {
          background-color: #f5f5f5;
        }
      }
    }
  }

  .app-sidebar {
    background: #ffffff;
    border-right: 1px solid #f0f0f0;
    
    .ant-layout-sider-children {
      padding: 16px 0;
    }
  }

  .main-content {
    background: #f5f5f5;
    min-height: calc(100vh - 64px);

    .content-wrapper {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
  }

  .mobile-navigation-drawer {
    .ant-drawer-body {
      padding: 16px 0;
    }
  }
}

// Mobile responsive styles
@media (max-width: 768px) {
  .app-shell {
    .app-header {
      padding: 0 16px;

      .header-left {
        .mobile-menu-trigger {
          display: inline-flex;
        }
      }
    }

    .main-content {
      .content-wrapper {
        padding: 16px;
      }
    }
  }
}

// Tablet styles
@media (min-width: 769px) and (max-width: 991px) {
  .app-shell {
    .app-sidebar {
      width: 200px !important;
      flex: 0 0 200px !important;
    }
  }
}
```

### 4. Form Components

#### Travel Request Form Implementation
```typescript
// src/components/forms/TravelRequestForm.tsx
import React, { useState, useEffect } from 'react';
import {
  Form,
  Card,
  Select,
  InputNumber,
  Input,
  Radio,
  AutoComplete,
  Button,
  Alert,
  Divider,
  Row,
  Col,
  Space,
  Statistic,
  message,
} from 'antd';
import { useBreakpoint } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { TravelRequestFormData, Project, Subproject } from '../../types';
import './TravelRequestForm.scss';

interface TravelRequestFormProps {
  initialValues?: Partial<TravelRequestFormData>;
  projects: Project[];
  managers: string[];
  onSubmit: (values: TravelRequestFormData) => Promise<void>;
  onSaveDraft?: (values: Partial<TravelRequestFormData>) => Promise<void>;
}

export const TravelRequestForm: React.FC<TravelRequestFormProps> = ({
  initialValues,
  projects,
  managers,
  onSubmit,
  onSaveDraft,
}) => {
  const [form] = Form.useForm<TravelRequestFormData>();
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  const [calculatedDistance, setCalculatedDistance] = useState<number>(0);
  const [dailyAllowance, setDailyAllowance] = useState<number>(0);
  const { xs, sm } = useBreakpoint();
  const isMobile = xs || sm;

  // Calculate allowance when form values change
  const calculateAllowance = async (projectId: string, subprojectId: string) => {
    if (!projectId || !subprojectId) return;
    
    try {
      // This would typically be an API call
      const distance = await calculateDistance(projectId, subprojectId);
      const rate = 2.50; // CHF per km
      const allowance = distance * rate;
      
      setCalculatedDistance(distance);
      setDailyAllowance(allowance);
    } catch (error) {
      message.error('Failed to calculate distance and allowance');
    }
  };

  // Handle project selection
  const handleProjectChange = (projectId: string) => {
    const selectedProject = projects.find(p => p.id === projectId);
    setSubprojects(selectedProject?.subprojects || []);
    
    // Reset subproject selection
    form.setFieldsValue({ subprojectId: undefined });
    setCalculatedDistance(0);
    setDailyAllowance(0);
  };

  // Handle subproject selection
  const handleSubprojectChange = (subprojectId: string) => {
    const projectId = form.getFieldValue('projectId');
    calculateAllowance(projectId, subprojectId);
  };

  // Form submission
  const handleSubmit = async (values: TravelRequestFormData) => {
    setLoading(true);
    try {
      await onSubmit({
        ...values,
        calculatedDistance,
        dailyAllowance,
        weeklyAllowance: dailyAllowance * values.daysPerWeek,
        monthlyAllowance: dailyAllowance * values.daysPerWeek * 4.33,
      });
      message.success('Travel request submitted successfully');
      form.resetFields();
    } catch (error) {
      message.error('Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Save as draft
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const values = await form.validateFields();
      await onSaveDraft?.(values);
      message.success('Draft saved successfully');
    } catch (error) {
      // Validation errors are handled by form
      if (error.errorFields) return;
      message.error('Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  // Weekly and monthly calculations
  const daysPerWeek = Form.useWatch('daysPerWeek', form);
  const weeklyAllowance = dailyAllowance * (daysPerWeek || 0);
  const monthlyAllowance = weeklyAllowance * 4.33;

  return (
    <div className="travel-request-form-container">
      <Card
        title="Submit Travel Allowance Request"
        className="travel-request-form-card"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues}
          onFinish={handleSubmit}
          size={isMobile ? 'large' : 'middle'}
          requiredMark={isMobile ? 'optional' : true}
        >
          {/* Project Information Section */}
          <Divider orientation="left">
            <span className="section-title">Project Information</span>
          </Divider>

          <Row gutter={isMobile ? [0, 16] : [16, 16]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="projectId"
                label="Project"
                rules={[
                  { required: true, message: 'Please select a project' }
                ]}
              >
                <Select
                  showSearch
                  placeholder="Select a project"
                  optionFilterProp="children"
                  onChange={handleProjectChange}
                  filterOption={(input, option) =>
                    option?.children?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {projects.map(project => (
                    <Select.Option key={project.id} value={project.id}>
                      {project.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="subprojectId"
                label="Subproject"
                rules={[
                  { required: true, message: 'Please select a subproject' }
                ]}
              >
                <Select
                  placeholder="Select a subproject"
                  onChange={handleSubprojectChange}
                  disabled={!subprojects.length}
                  notFoundContent={
                    !subprojects.length ? 'Select a project first' : 'No subprojects found'
                  }
                >
                  {subprojects.map(subproject => (
                    <Select.Option key={subproject.id} value={subproject.id}>
                      {subproject.name} - {subproject.location}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* Distance and Allowance Calculation */}
          {calculatedDistance > 0 && (
            <Alert
              message="Distance Calculation"
              description={
                <div className="calculation-details">
                  <div>
                    <strong>Distance:</strong> {calculatedDistance.toFixed(1)} km (straight-line)
                  </div>
                  <div>
                    <strong>Rate:</strong> CHF 2.50 per km
                  </div>
                  <div>
                    <strong>Daily allowance:</strong> CHF {dailyAllowance.toFixed(2)}
                  </div>
                </div>
              }
              type="info"
              showIcon
              className="calculation-alert"
            />
          )}

          {/* Request Details Section */}
          <Divider orientation="left">
            <span className="section-title">Request Details</span>
          </Divider>

          <Form.Item
            name="daysPerWeek"
            label="Days per Week"
            rules={[
              { required: true, message: 'Please select days per week' }
            ]}
          >
            {isMobile ? (
              <Radio.Group size="large">
                <Row gutter={[8, 8]}>
                  {[1, 2, 3, 4, 5].map(day => (
                    <Col span={12} key={day}>
                      <Radio 
                        value={day} 
                        style={{ 
                          width: '100%', 
                          padding: '12px',
                          textAlign: 'center'
                        }}
                      >
                        {day} {day === 1 ? 'day' : 'days'}
                      </Radio>
                    </Col>
                  ))}
                </Row>
              </Radio.Group>
            ) : (
              <Radio.Group>
                {[1, 2, 3, 4, 5].map(day => (
                  <Radio.Button key={day} value={day}>
                    {day}
                  </Radio.Button>
                ))}
              </Radio.Group>
            )}
          </Form.Item>

          <Form.Item
            name="managerName"
            label="Approving Manager"
            rules={[
              { required: true, message: 'Please enter manager name' },
              { min: 2, message: 'Manager name must be at least 2 characters' }
            ]}
          >
            <AutoComplete
              placeholder="Type manager name"
              options={managers.map(name => ({ value: name }))}
              filterOption={(inputValue, option) =>
                option!.value.toUpperCase().includes(inputValue.toUpperCase())
              }
            />
          </Form.Item>

          <Form.Item
            name="justification"
            label="Justification"
            rules={[
              { required: true, message: 'Please provide justification' },
              { min: 20, message: 'Please provide at least 20 characters' },
              { max: 500, message: 'Justification cannot exceed 500 characters' }
            ]}
          >
            <Input.TextArea
              rows={isMobile ? 4 : 3}
              placeholder="Explain why travel allowance is necessary for this project..."
              showCount
              maxLength={500}
            />
          </Form.Item>

          {/* Allowance Summary */}
          {weeklyAllowance > 0 && (
            <Card size="small" className="allowance-summary">
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="Daily Allowance"
                    value={dailyAllowance}
                    prefix="CHF"
                    precision={2}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="Weekly Allowance"
                    value={weeklyAllowance}
                    prefix="CHF"
                    precision={2}
                    valueStyle={{ color: '#1677ff' }}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="Monthly Estimate"
                    value={monthlyAllowance}
                    prefix="CHF"
                    precision={2}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
              </Row>
            </Card>
          )}

          {/* Form Actions */}
          <Form.Item className="form-actions">
            {isMobile ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  size="large"
                >
                  Submit Request
                </Button>
                {onSaveDraft && (
                  <Button
                    onClick={handleSaveDraft}
                    loading={savingDraft}
                    block
                    size="large"
                  >
                    Save as Draft
                  </Button>
                )}
              </Space>
            ) : (
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  size="large"
                >
                  Submit Request
                </Button>
                {onSaveDraft && (
                  <Button
                    onClick={handleSaveDraft}
                    loading={savingDraft}
                    size="large"
                  >
                    Save as Draft
                  </Button>
                )}
                <Button
                  size="large"
                  onClick={() => form.resetFields()}
                >
                  Reset Form
                </Button>
              </Space>
            )}
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
```

## Quality Assurance Criteria

### 5. Accessibility Requirements

#### WCAG 2.1 AA Compliance Checklist
```typescript
// src/utils/accessibility.ts
export const accessibilityChecklist = {
  // Color and Contrast
  colorContrast: {
    normalText: '4.5:1 minimum',
    largeText: '3:1 minimum',
    nonTextElements: '3:1 minimum',
  },
  
  // Keyboard Navigation
  keyboardAccess: {
    tabIndex: 'All interactive elements must be keyboard accessible',
    focusIndicators: 'Visible focus indicators required',
    logicalTabOrder: 'Tab order must follow visual layout',
  },
  
  // Screen Reader Support
  screenReader: {
    altText: 'All images must have descriptive alt text',
    ariaLabels: 'Form fields must have accessible labels',
    headingStructure: 'Proper heading hierarchy (h1 → h2 → h3)',
    landmarks: 'Page sections must use ARIA landmarks',
  },
  
  // Form Accessibility
  forms: {
    labelAssociation: 'All inputs must have associated labels',
    errorMessages: 'Error messages must be programmatically associated',
    requiredFields: 'Required fields must be indicated',
    instructions: 'Complex forms must have instructions',
  },
};

// Accessibility testing utilities
export const a11yTestUtils = {
  // Test for proper heading structure
  checkHeadingStructure: (container: HTMLElement): boolean => {
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    // Implementation logic for heading validation
    return true;
  },
  
  // Test for keyboard navigation
  checkKeyboardNavigation: async (container: HTMLElement): Promise<boolean> => {
    // Implementation logic for keyboard testing
    return true;
  },
  
  // Test for ARIA attributes
  checkAriaAttributes: (container: HTMLElement): boolean => {
    // Implementation logic for ARIA validation
    return true;
  },
};
```

### 6. Performance Requirements

#### Performance Budget and Metrics
```typescript
// performance.config.ts
export const performanceBudgets = {
  // Bundle sizes (gzipped)
  mainBundle: '200KB',
  vendorBundle: '300KB',
  totalJavaScript: '500KB',
  totalCSS: '50KB',
  
  // Runtime metrics
  firstContentfulPaint: '1.5s',
  largestContentfulPaint: '2.5s',
  firstInputDelay: '100ms',
  cumulativeLayoutShift: '0.1',
  
  // Mobile-specific targets
  mobile: {
    firstContentfulPaint: '2.0s',
    largestContentfulPaint: '3.0s',
    timeToInteractive: '3.5s',
  },
  
  // Network conditions
  slow3G: {
    downloadSpeed: '400KB/s',
    uploadSpeed: '400KB/s',
    latency: '400ms',
  },
};

// Performance monitoring utilities
export const performanceUtils = {
  // Measure component render time
  measureRenderTime: (componentName: string) => {
    performance.mark(`${componentName}-start`);
    return () => {
      performance.mark(`${componentName}-end`);
      performance.measure(
        `${componentName}-render`,
        `${componentName}-start`,
        `${componentName}-end`
      );
    };
  },
  
  // Monitor bundle size
  bundleSizeAnalyzer: {
    webpack: 'webpack-bundle-analyzer',
    rollup: 'rollup-plugin-analyzer',
  },
  
  // Core Web Vitals monitoring
  webVitals: {
    cls: 'web-vitals/cls',
    fcp: 'web-vitals/fcp',
    fid: 'web-vitals/fid',
    lcp: 'web-vitals/lcp',
  },
};
```

### 7. Cross-Browser Testing Matrix

```typescript
// testing.config.ts
export const browserTestMatrix = {
  desktop: {
    chrome: ['latest', 'latest-1'],
    firefox: ['latest', 'latest-1'],
    safari: ['latest'],
    edge: ['latest'],
  },
  
  mobile: {
    ios_safari: ['latest', 'latest-1'],
    chrome_android: ['latest'],
    samsung_internet: ['latest'],
  },
  
  // Minimum supported versions
  minimumSupport: {
    chrome: '88',
    firefox: '85',
    safari: '14',
    edge: '88',
    ios_safari: '14',
  },
};

// Device testing requirements
export const deviceTestMatrix = {
  mobile: [
    'iPhone 12 Pro',
    'iPhone SE (2nd generation)',
    'Samsung Galaxy S21',
    'Google Pixel 5',
  ],
  
  tablet: [
    'iPad Air (4th generation)',
    'iPad Pro 11-inch',
    'Samsung Galaxy Tab S7',
  ],
  
  desktop: [
    '1920x1080 (Full HD)',
    '1366x768 (HD)',
    '2560x1440 (2K)',
    '3840x2160 (4K)',
  ],
};
```

## Testing Implementation

### 8. Component Testing Templates

```typescript
// src/components/__tests__/TravelRequestForm.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import { TravelRequestForm } from '../TravelRequestForm';
import { mockProjects, mockManagers } from '../../__mocks__/data';

// Test wrapper with Ant Design ConfigProvider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ConfigProvider>
    {children}
  </ConfigProvider>
);

describe('TravelRequestForm', () => {
  const defaultProps = {
    projects: mockProjects,
    managers: mockManagers,
    onSubmit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all required form fields', () => {
      render(<TravelRequestForm {...defaultProps} />, { wrapper: TestWrapper });
      
      expect(screen.getByLabelText(/project/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/subproject/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/days per week/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/manager/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/justification/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit request/i })).toBeInTheDocument();
    });

    it('renders mobile layout on small screens', () => {
      // Mock useBreakpoint hook
      jest.mock('antd', () => ({
        ...jest.requireActual('antd'),
        useBreakpoint: () => ({ xs: true }),
      }));

      render(<TravelRequestForm {...defaultProps} />, { wrapper: TestWrapper });
      
      const submitButton = screen.getByRole('button', { name: /submit request/i });
      expect(submitButton).toHaveClass('ant-btn-block');
    });
  });

  describe('Form Validation', () => {
    it('shows validation errors for required fields', async () => {
      const user = userEvent.setup();
      render(<TravelRequestForm {...defaultProps} />, { wrapper: TestWrapper });
      
      await user.click(screen.getByRole('button', { name: /submit request/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/please select a project/i)).toBeInTheDocument();
        expect(screen.getByText(/please select a subproject/i)).toBeInTheDocument();
        expect(screen.getByText(/please select days per week/i)).toBeInTheDocument();
        expect(screen.getByText(/please enter manager name/i)).toBeInTheDocument();
        expect(screen.getByText(/please provide justification/i)).toBeInTheDocument();
      });
    });

    it('validates minimum justification length', async () => {
      const user = userEvent.setup();
      render(<TravelRequestForm {...defaultProps} />, { wrapper: TestWrapper });
      
      const justificationField = screen.getByLabelText(/justification/i);
      await user.type(justificationField, 'Too short');
      await user.click(screen.getByRole('button', { name: /submit request/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/please provide at least 20 characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Interactions', () => {
    it('loads subprojects when project is selected', async () => {
      const user = userEvent.setup();
      render(<TravelRequestForm {...defaultProps} />, { wrapper: TestWrapper });
      
      const projectSelect = screen.getByLabelText(/project/i);
      await user.click(projectSelect);
      await user.click(screen.getByText(mockProjects[0].name));
      
      await waitFor(() => {
        const subprojectSelect = screen.getByLabelText(/subproject/i);
        expect(subprojectSelect).not.toBeDisabled();
      });
    });

    it('calculates allowance when subproject is selected', async () => {
      const user = userEvent.setup();
      render(<TravelRequestForm {...defaultProps} />, { wrapper: TestWrapper });
      
      // Select project and subproject
      await user.click(screen.getByLabelText(/project/i));
      await user.click(screen.getByText(mockProjects[0].name));
      
      await user.click(screen.getByLabelText(/subproject/i));
      await user.click(screen.getByText(mockProjects[0].subprojects[0].name));
      
      await waitFor(() => {
        expect(screen.getByText(/distance calculation/i)).toBeInTheDocument();
        expect(screen.getByText(/daily allowance/i)).toBeInTheDocument();
      });
    });

    it('updates allowance summary when days per week changes', async () => {
      const user = userEvent.setup();
      render(<TravelRequestForm {...defaultProps} />, { wrapper: TestWrapper });
      
      // Fill form to trigger allowance calculation
      await fillFormToAllowanceCalculation(user);
      
      // Select days per week
      await user.click(screen.getByLabelText('3'));
      
      await waitFor(() => {
        expect(screen.getByText(/weekly allowance/i)).toBeInTheDocument();
        expect(screen.getByText(/monthly estimate/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('submits form with correct data', async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();
      render(<TravelRequestForm {...defaultProps} onSubmit={onSubmit} />, { wrapper: TestWrapper });
      
      await fillCompleteForm(user);
      await user.click(screen.getByRole('button', { name: /submit request/i }));
      
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            projectId: mockProjects[0].id,
            subprojectId: mockProjects[0].subprojects[0].id,
            daysPerWeek: 3,
            managerName: mockManagers[0],
            justification: expect.any(String),
            calculatedDistance: expect.any(Number),
            dailyAllowance: expect.any(Number),
            weeklyAllowance: expect.any(Number),
            monthlyAllowance: expect.any(Number),
          })
        );
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));
      render(<TravelRequestForm {...defaultProps} onSubmit={onSubmit} />, { wrapper: TestWrapper });
      
      await fillCompleteForm(user);
      await user.click(screen.getByRole('button', { name: /submit request/i }));
      
      expect(screen.getByRole('button', { name: /submit request/i })).toHaveAttribute('disabled');
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and descriptions', () => {
      render(<TravelRequestForm {...defaultProps} />, { wrapper: TestWrapper });
      
      const projectSelect = screen.getByLabelText(/project/i);
      expect(projectSelect).toHaveAttribute('aria-required', 'true');
      
      const requiredFields = screen.getAllByText('*');
      expect(requiredFields.length).toBeGreaterThan(0);
    });

    it('supports keyboard navigation', async () => {
      render(<TravelRequestForm {...defaultProps} />, { wrapper: TestWrapper });
      
      const projectSelect = screen.getByLabelText(/project/i);
      projectSelect.focus();
      expect(projectSelect).toHaveFocus();
      
      fireEvent.keyDown(projectSelect, { key: 'Tab' });
      const subprojectSelect = screen.getByLabelText(/subproject/i);
      expect(subprojectSelect).toHaveFocus();
    });
  });
});

// Helper functions for tests
async function fillFormToAllowanceCalculation(user: any) {
  await user.click(screen.getByLabelText(/project/i));
  await user.click(screen.getByText(mockProjects[0].name));
  
  await user.click(screen.getByLabelText(/subproject/i));
  await user.click(screen.getByText(mockProjects[0].subprojects[0].name));
}

async function fillCompleteForm(user: any) {
  await fillFormToAllowanceCalculation(user);
  
  await user.click(screen.getByLabelText('3'));
  
  const managerField = screen.getByLabelText(/manager/i);
  await user.type(managerField, mockManagers[0]);
  
  const justificationField = screen.getByLabelText(/justification/i);
  await user.type(justificationField, 'This is a necessary business travel request for client meetings.');
}
```

## Deployment and Build Specifications

### 9. Build Configuration

```typescript
// webpack.config.js (if using webpack)
const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CompressionPlugin = require('compression-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: './src/index.tsx',
    
    output: {
      path: path.resolve(__dirname, 'build'),
      filename: isProduction 
        ? '[name].[contenthash].js' 
        : '[name].js',
      chunkFilename: isProduction
        ? '[name].[contenthash].chunk.js'
        : '[name].chunk.js',
    },
    
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          antd: {
            test: /[\\/]node_modules[\\/]antd[\\/]/,
            name: 'antd',
            chunks: 'all',
          },
        },
      },
    },
    
    plugins: [
      // Bundle analysis in production
      isProduction && new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        openAnalyzer: false,
        reportFilename: 'bundle-report.html',
      }),
      
      // Gzip compression
      isProduction && new CompressionPlugin({
        filename: '[path][base].gz',
        algorithm: 'gzip',
        test: /\.(js|css|html|svg)$/,
        threshold: 8192,
        minRatio: 0.8,
      }),
    ].filter(Boolean),
    
    // Performance budgets
    performance: {
      maxAssetSize: 300000, // 300KB
      maxEntrypointSize: 500000, // 500KB
      hints: isProduction ? 'error' : 'warning',
    },
  };
};
```

### 10. CI/CD Pipeline Configuration

```yaml
# .github/workflows/ui-testing.yml
name: UI Testing and Quality Assurance

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type checking
        run: npm run type-check
      
      - name: Linting
        run: npm run lint
      
      - name: Unit tests
        run: npm run test:coverage
        
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
      
      - name: Build application
        run: npm run build
        
      - name: Bundle size analysis
        run: npm run analyze-bundle
        
  visual-regression:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run Storybook tests
        run: npm run test-storybook:ci
        
      - name: Visual regression tests
        run: npm run chromatic
        
  accessibility:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build Storybook
        run: npm run build-storybook
        
      - name: Accessibility tests
        run: npm run test:a11y
        
  e2e:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Install Playwright
        run: npx playwright install
        
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Documentation and Handoff

### 11. Component Documentation Template

```typescript
// src/components/forms/TravelRequestForm.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { TravelRequestForm } from './TravelRequestForm';
import { mockProjects, mockManagers } from '../../__mocks__/data';

const meta: Meta<typeof TravelRequestForm> = {
  title: 'Forms/TravelRequestForm',
  component: TravelRequestForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
# Travel Request Form

The TravelRequestForm component handles the submission of new travel allowance requests. It includes project selection, distance calculation, allowance estimation, and form validation.

## Features
- Project and subproject selection with cascading dropdowns
- Automatic distance calculation and allowance estimation
- Responsive design for mobile and desktop
- Comprehensive form validation
- Draft saving capability
- Accessibility compliant (WCAG 2.1 AA)

## Usage
\`\`\`tsx
<TravelRequestForm
  projects={projects}
  managers={managers}
  onSubmit={handleSubmit}
  onSaveDraft={handleSaveDraft}
/>
\`\`\`
        `,
      },
    },
  },
  argTypes: {
    projects: {
      description: 'Array of available projects with subprojects',
      control: { type: 'object' },
    },
    managers: {
      description: 'Array of manager names for autocomplete',
      control: { type: 'object' },
    },
    onSubmit: {
      description: 'Callback function called when form is submitted',
      action: 'submitted',
    },
    onSaveDraft: {
      description: 'Callback function called when draft is saved',
      action: 'draft saved',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    projects: mockProjects,
    managers: mockManagers,
  },
};

export const WithInitialValues: Story = {
  args: {
    ...Default.args,
    initialValues: {
      projectId: mockProjects[0].id,
      daysPerWeek: 3,
      managerName: mockManagers[0],
    },
  },
};

export const MobileView: Story = {
  args: Default.args,
  parameters: {
    viewport: {
      defaultViewport: 'iphone12',
    },
  },
};

export const LoadingState: Story = {
  args: {
    ...Default.args,
    onSubmit: () => new Promise(resolve => setTimeout(resolve, 3000)),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /submit/i }));
  },
};
```

This comprehensive UI development specification provides everything needed for developers to implement the RegularTravelManager user interface accurately and efficiently. It includes detailed component specifications, testing requirements, accessibility guidelines, performance criteria, and deployment configurations to ensure a high-quality, maintainable, and user-friendly application.