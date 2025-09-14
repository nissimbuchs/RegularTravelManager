# Responsive Design Guidelines - RegularTravelManager

**Date:** 2025-08-30
**Created by:** UX Design Session via Claude Code
**Framework:** Angular + TypeScript + Angular Material v17
**Approach:** Mobile-First Progressive Enhancement

## Overview

This document outlines responsive design patterns and implementation guidelines for RegularTravelManager, ensuring optimal user experience across all devices and screen sizes. The design follows mobile-first principles while leveraging Angular Flex Layout and CSS Grid.

## Breakpoint Strategy

### Ant Design Breakpoint System
```typescript
const breakpoints = {
  xs: 0,      // Extra small devices (phones, < 576px)
  sm: 576,    // Small devices (landscape phones, ≥ 576px)
  md: 768,    // Medium devices (tablets, ≥ 768px)
  lg: 992,    // Large devices (desktops, ≥ 992px)
  xl: 1200,   // Extra large devices (large desktops, ≥ 1200px)
  xxl: 1600,  // Extra extra large devices (≥ 1600px)
};
```

### Custom Media Queries
```css
/* Custom breakpoints for specific use cases */
:root {
  --mobile: '(max-width: 767px)';
  --tablet: '(min-width: 768px) and (max-width: 991px)';
  --desktop: '(min-width: 992px)';
  --touch-device: '(hover: none) and (pointer: coarse)';
}
```

## Layout Patterns

### 1. Application Shell

#### Mobile Layout (< 768px)
```typescript
const MobileAppShell: React.FC = ({ children }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  return (
    <Layout className="mobile-app-shell">
      {/* Fixed header with hamburger menu */}
      <Layout.Header className="mobile-header">
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setDrawerOpen(true)}
          className="mobile-menu-trigger"
        />
        <div className="mobile-logo">TravelMgr</div>
        <Badge count={3} size="small">
          <Button type="text" icon={<BellOutlined />} />
        </Badge>
      </Layout.Header>
      
      {/* Drawer navigation */}
      <Drawer
        placement="left"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        className="mobile-navigation-drawer"
        width={280}
      >
        <MobileNavigationMenu onNavigate={() => setDrawerOpen(false)} />
      </Drawer>
      
      {/* Scrollable content area */}
      <Layout.Content className="mobile-content">
        {children}
      </Layout.Content>
      
      {/* Fixed bottom navigation for key actions */}
      <div className="mobile-bottom-nav">
        <Button type="primary" icon={<PlusOutlined />} block>
          New Request
        </Button>
      </div>
    </Layout>
  );
};
```

#### Desktop Layout (≥ 992px)
```typescript
const DesktopAppShell: React.FC = ({ children }) => {
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  
  return (
    <Layout className="desktop-app-shell" style={{ minHeight: '100vh' }}>
      {/* Fixed header */}
      <Layout.Header className="desktop-header">
        <div className="header-left">
          <div className="desktop-logo">RegularTravelManager</div>
        </div>
        <div className="header-right">
          <Space size="middle">
            <Badge count={3}>
              <Button type="text" icon={<BellOutlined />} />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }}>
              <Button type="text">
                <UserOutlined /> John Doe <DownOutlined />
              </Button>
            </Dropdown>
          </Space>
        </div>
      </Layout.Header>
      
      <Layout>
        {/* Collapsible sidebar */}
        <Layout.Sider
          collapsed={siderCollapsed}
          onCollapse={setSiderCollapsed}
          theme="light"
          width={240}
          collapsedWidth={64}
        >
          <DesktopNavigationMenu collapsed={siderCollapsed} />
        </Layout.Sider>
        
        {/* Main content with padding */}
        <Layout.Content className="desktop-content">
          <div className="content-wrapper">
            {children}
          </div>
        </Layout.Content>
      </Layout>
    </Layout>
  );
};
```

### 2. Responsive Grid Layouts

#### Dashboard Grid System
```typescript
const ResponsiveDashboard: React.FC = () => {
  return (
    <div className="responsive-dashboard">
      {/* Statistics Cards */}
      <Row gutter={[16, 16]} className="dashboard-stats">
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard title="Pending" value={5} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard title="Approved" value={12} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard title="This Month" value="CHF 450" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard title="Total" value={25} />
        </Col>
      </Row>
      
      {/* Main Content Area */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {/* Recent Requests - Full width on mobile, 2/3 on desktop */}
        <Col xs={24} lg={16}>
          <Card title="Recent Requests">
            <RecentRequestsList />
          </Card>
        </Col>
        
        {/* Quick Actions - Full width on mobile, 1/3 on desktop */}
        <Col xs={24} lg={8}>
          <Card title="Quick Actions">
            <QuickActionPanel />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
```

## Component Responsive Patterns

### 3. Form Components

#### Travel Request Form - Mobile First
```typescript
const ResponsiveTravelRequestForm: React.FC = () => {
  const [form] = Form.useForm();
  const { xs, sm, md } = useBreakpoint();
  
  return (
    <Card 
      title="New Travel Request" 
      className="travel-request-form"
      style={{ margin: xs ? 0 : '0 auto', maxWidth: md ? 800 : 'none' }}
    >
      <Form
        form={form}
        layout="vertical"
        size={xs ? 'large' : 'middle'}
        requiredMark={xs ? 'optional' : true}
      >
        {/* Project Selection - Responsive layout */}
        <Row gutter={xs ? 0 : 16}>
          <Col xs={24} sm={12}>
            <Form.Item name="projectId" label="Project" required>
              <Select
                showSearch
                placeholder="Select project"
                size={xs ? 'large' : 'middle'}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="subprojectId" label="Subproject" required>
              <Select
                placeholder="Select subproject"
                size={xs ? 'large' : 'middle'}
              />
            </Form.Item>
          </Col>
        </Row>
        
        {/* Days per week - Different layouts by screen size */}
        <Form.Item name="daysPerWeek" label="Days per Week" required>
          {xs ? (
            // Mobile: Vertical radio buttons with larger touch targets
            <Radio.Group size="large">
              <Row gutter={[8, 8]}>
                {[1, 2, 3, 4, 5].map(day => (
                  <Col span={12} key={day}>
                    <Radio value={day} style={{ width: '100%', padding: '12px' }}>
                      {day} {day === 1 ? 'day' : 'days'} per week
                    </Radio>
                  </Col>
                ))}
              </Row>
            </Radio.Group>
          ) : (
            // Desktop: Horizontal radio buttons
            <Radio.Group>
              {[1, 2, 3, 4, 5].map(day => (
                <Radio.Button key={day} value={day}>
                  {day}
                </Radio.Button>
              ))}
            </Radio.Group>
          )}
        </Form.Item>
        
        {/* Manager field */}
        <Form.Item name="managerName" label="Approving Manager" required>
          <AutoComplete
            placeholder="Type manager name"
            size={xs ? 'large' : 'middle'}
          />
        </Form.Item>
        
        {/* Justification */}
        <Form.Item name="justification" label="Justification" required>
          <Input.TextArea
            rows={xs ? 4 : 3}
            placeholder="Explain why travel allowance is necessary..."
            showCount
            maxLength={500}
          />
        </Form.Item>
        
        {/* Submit buttons - Different layouts */}
        <Form.Item style={{ marginTop: 32 }}>
          {xs ? (
            // Mobile: Stacked full-width buttons
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" htmlType="submit" block size="large">
                Submit Request
              </Button>
              <Button block size="large">
                Save as Draft
              </Button>
            </Space>
          ) : (
            // Desktop: Inline buttons
            <Space>
              <Button type="primary" htmlType="submit" size="large">
                Submit Request
              </Button>
              <Button size="large">Save as Draft</Button>
            </Space>
          )}
        </Form.Item>
      </Form>
    </Card>
  );
};
```

### 4. Data Tables - Mobile Transformation

#### Desktop Table View
```typescript
const DesktopRequestTable: React.FC = ({ requests }) => {
  const columns = [
    {
      title: 'Project',
      dataIndex: ['project', 'name'],
      key: 'project',
    },
    {
      title: 'Manager',
      dataIndex: 'managerName',
      key: 'manager',
    },
    {
      title: 'Weekly Allowance',
      dataIndex: 'weeklyAllowance',
      key: 'allowance',
      render: (amount: number) => `CHF ${amount.toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusTag status={status} />,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small">View</Button>
          <Button size="small">Edit</Button>
        </Space>
      ),
    },
  ];
  
  return (
    <Table
      columns={columns}
      dataSource={requests}
      pagination={{ pageSize: 10 }}
      scroll={{ x: 800 }}
    />
  );
};
```

#### Mobile Card View
```typescript
const MobileRequestCards: React.FC = ({ requests }) => {
  return (
    <div className="mobile-request-cards">
      {requests.map(request => (
        <Card
          key={request.id}
          size="small"
          className="mobile-request-card"
          actions={[
            <Button key="view" type="link" size="small">View</Button>,
            <Button key="edit" type="link" size="small">Edit</Button>,
          ]}
        >
          <div className="card-header">
            <Typography.Text strong>{request.project.name}</Typography.Text>
            <StatusTag status={request.status} />
          </div>
          
          <div className="card-details">
            <Row gutter={[8, 4]}>
              <Col span={12}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Manager
                </Typography.Text>
                <div>{request.managerName}</div>
              </Col>
              <Col span={12}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Weekly Allowance
                </Typography.Text>
                <div>CHF {request.weeklyAllowance.toFixed(2)}</div>
              </Col>
            </Row>
          </div>
          
          <Typography.Text 
            type="secondary" 
            style={{ fontSize: 11, marginTop: 8 }}
          >
            {dayjs(request.createdAt).fromNow()}
          </Typography.Text>
        </Card>
      ))}
    </div>
  );
};
```

#### Responsive Table/Card Switcher
```typescript
const ResponsiveRequestList: React.FC = ({ requests }) => {
  const { xs } = useBreakpoint();
  
  return xs ? (
    <MobileRequestCards requests={requests} />
  ) : (
    <DesktopRequestTable requests={requests} />
  );
};
```

## Touch and Interaction Patterns

### 5. Touch-Friendly Components

```css
/* Touch target sizing */
@media (hover: none) and (pointer: coarse) {
  /* Minimum 44px touch targets */
  .ant-btn,
  .ant-input,
  .ant-select-selector,
  .ant-radio-button-wrapper {
    min-height: 44px !important;
    padding: 12px 16px !important;
  }
  
  /* Larger checkbox and radio buttons */
  .ant-checkbox-wrapper,
  .ant-radio-wrapper {
    padding: 8px;
    margin: 4px 0;
  }
  
  .ant-checkbox-inner,
  .ant-radio-inner {
    width: 20px;
    height: 20px;
  }
  
  /* Increased spacing for lists */
  .ant-list-item {
    padding: 16px !important;
  }
  
  /* Swipe indicators for horizontal scrolling */
  .horizontal-scroll::after {
    content: '';
    position: absolute;
    right: 0;
    top: 50%;
    width: 20px;
    height: 40px;
    background: linear-gradient(90deg, transparent, rgba(0,0,0,0.1));
    pointer-events: none;
  }
}
```

### 6. Gesture Support

```typescript
// Swipe gesture for mobile navigation
const SwipeableDrawer: React.FC = ({ children, open, onClose }) => {
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  
  const handleTouchStart = (e: TouchEvent) => {
    setTouchEnd(0);
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const handleTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    
    if (isLeftSwipe && open) {
      onClose();
    }
  };
  
  return (
    <Drawer
      placement="left"
      open={open}
      onClose={onClose}
      className="swipeable-drawer"
    >
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </Drawer>
  );
};
```

## Performance Optimizations

### 7. Image and Content Loading

```typescript
// Responsive image loading
const ResponsiveImage: React.FC<{
  src: string;
  alt: string;
  sizes?: string;
}> = ({ src, alt, sizes = "(max-width: 768px) 100vw, 50vw" }) => {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      sizes={sizes}
      style={{ 
        width: '100%', 
        height: 'auto',
        objectFit: 'cover'
      }}
    />
  );
};

// Conditional component rendering for performance
const ConditionalMobileFeatures: React.FC = () => {
  const { xs } = useBreakpoint();
  
  return (
    <>
      {xs && (
        <Suspense fallback={<Skeleton />}>
          <MobilePullToRefresh />
        </Suspense>
      )}
      
      {!xs && (
        <Suspense fallback={null}>
          <DesktopKeyboardShortcuts />
        </Suspense>
      )}
    </>
  );
};
```

## CSS Architecture

### 8. Mobile-First Sass Structure

```scss
// Base mobile styles (no media query)
.travel-request-form {
  padding: 16px;
  
  .form-section {
    margin-bottom: 24px;
    
    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
    }
  }
  
  .form-actions {
    position: sticky;
    bottom: 0;
    background: white;
    padding: 16px;
    border-top: 1px solid #f0f0f0;
    margin: 0 -16px -16px;
    
    .ant-btn {
      width: 100%;
      height: 48px;
      margin-bottom: 12px;
      
      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}

// Tablet styles
@media (min-width: 768px) {
  .travel-request-form {
    padding: 24px;
    max-width: 600px;
    margin: 0 auto;
    
    .form-actions {
      position: static;
      padding: 24px 0 0;
      margin: 0;
      border-top: none;
      
      .ant-btn {
        width: auto;
        height: auto;
        margin-bottom: 0;
        margin-right: 12px;
      }
    }
  }
}

// Desktop styles
@media (min-width: 992px) {
  .travel-request-form {
    max-width: 800px;
    padding: 32px;
    
    .form-section {
      margin-bottom: 32px;
    }
    
    .two-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
  }
}
```

## Testing Responsive Design

### 9. Responsive Testing Setup

```typescript
// Custom hook for testing responsive behavior
export const useResponsiveTest = () => {
  const [screenSize, setScreenSize] = useState<string>('desktop');
  
  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      if (width < 768) setScreenSize('mobile');
      else if (width < 992) setScreenSize('tablet');
      else setScreenSize('desktop');
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
  return screenSize;
};

// Jest test for responsive components
describe('ResponsiveTravelRequestForm', () => {
  it('should render mobile layout on small screens', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 600,
    });
    
    render(<ResponsiveTravelRequestForm />);
    
    expect(screen.getByText(/days per week/i)).toBeInTheDocument();
    // Check for mobile-specific elements
    expect(screen.getByRole('button', { name: /submit request/i }))
      .toHaveClass('ant-btn-block');
  });
  
  it('should render desktop layout on large screens', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });
    
    render(<ResponsiveTravelRequestForm />);
    
    // Check for desktop-specific elements
    expect(screen.getByRole('button', { name: /submit request/i }))
      .not.toHaveClass('ant-btn-block');
  });
});
```

### 10. Visual Regression Testing

```typescript
// Storybook stories for responsive testing
export default {
  title: 'Components/TravelRequestForm',
  component: TravelRequestForm,
} as ComponentMeta<typeof TravelRequestForm>;

export const Mobile = Template.bind({});
Mobile.parameters = {
  viewport: {
    defaultViewport: 'iphone12',
  },
  chromatic: {
    viewports: [375],
  },
};

export const Tablet = Template.bind({});
Tablet.parameters = {
  viewport: {
    defaultViewport: 'ipad',
  },
  chromatic: {
    viewports: [768],
  },
};

export const Desktop = Template.bind({});
Desktop.parameters = {
  viewport: {
    defaultViewport: 'desktop',
  },
  chromatic: {
    viewports: [1200],
  },
};
```

## Epic 5.1: User Management Responsive Patterns

### User Registration Form - Mobile First
```typescript
const ResponsiveUserRegistrationForm: React.FC = () => {
  const { xs, sm } = useBreakpoint();
  const isMobile = xs || sm;

  return (
    <div className="registration-container">
      <Card
        className="registration-card"
        style={{
          margin: isMobile ? '0 16px' : '0 auto',
          maxWidth: isMobile ? 'none' : '600px',
          marginTop: isMobile ? '16px' : '40px'
        }}
      >
        <div className="registration-header">
          <div className="elca-logo-container">
            <img src="/assets/elca-logo-square.svg" alt="ELCA Informatik SA" className="elca-logo" />
          </div>
          {isMobile ? (
            <Typography.Title level={3} className="elca-heading">Create Account</Typography.Title>
          ) : (
            <Typography.Title level={2} className="elca-heading">Create Your Account</Typography.Title>
          )}
          <Typography.Text type="secondary">Welcome to ELCA RegularTravelManager</Typography.Text>
        </div>

        <Form layout="vertical" size={isMobile ? 'large' : 'middle'}>
          {/* Password field with responsive strength indicator */}
          <Form.Item name="password" label="Password">
            <Input.Password size={isMobile ? 'large' : 'middle'} />
          </Form.Item>

          <div className="password-strength-container">
            <Progress
              size={isMobile ? 'default' : 'small'}
              strokeWidth={isMobile ? 6 : 4}
            />
          </div>

          {/* Responsive name fields */}
          <Row gutter={isMobile ? [0, 16] : [16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item name="firstName" label="First Name">
                <Input size={isMobile ? 'large' : 'middle'} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="lastName" label="Last Name">
                <Input size={isMobile ? 'large' : 'middle'} />
              </Form.Item>
            </Col>
          </Row>

          {/* Mobile-optimized submit button */}
          <Form.Item>
            {isMobile ? (
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                style={{ height: '48px' }}
              >
                Create Account
              </Button>
            ) : (
              <Button type="primary" htmlType="submit" size="large">
                Create Account
              </Button>
            )}
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
```

### Admin User Management - Responsive Table
```typescript
const ResponsiveUserManagementTable: React.FC = () => {
  const { xs, sm, md } = useBreakpoint();
  const isMobile = xs;
  const isTablet = sm;

  if (isMobile) {
    // Mobile card view
    return (
      <div className="mobile-user-management">
        <div className="mobile-search">
          <Input.Search
            placeholder="Search users..."
            size="large"
            style={{ marginBottom: 16 }}
          />
        </div>

        <div className="mobile-filters">
          <Row gutter={8}>
            <Col span={12}>
              <Select placeholder="Role" size="large" style={{ width: '100%' }}>
                <Option value="all">All Roles</Option>
                <Option value="employee">Employees</Option>
                <Option value="manager">Managers</Option>
                <Option value="admin">Administrators</Option>
              </Select>
            </Col>
            <Col span={12}>
              <Select placeholder="Status" size="large" style={{ width: '100%' }}>
                <Option value="all">All Status</Option>
                <Option value="active">Active</Option>
                <Option value="inactive">Inactive</Option>
              </Select>
            </Col>
          </Row>
        </div>

        <List
          dataSource={users}
          renderItem={(user) => (
            <List.Item className="mobile-user-card">
              <Card size="small" className="user-card">
                <div className="user-card-header">
                  <Avatar icon={<UserOutlined />} />
                  <div className="user-info">
                    <Typography.Text strong>{user.name}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {user.email}
                    </Typography.Text>
                  </div>
                  <Tag color="blue">{user.role}</Tag>
                </div>

                <div className="user-card-details">
                  <Row gutter={8}>
                    <Col span={12}>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        Department
                      </Typography.Text>
                      <div>{user.department}</div>
                    </Col>
                    <Col span={12}>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        Last Login
                      </Typography.Text>
                      <div>{user.lastLogin ? dayjs(user.lastLogin).fromNow() : 'Never'}</div>
                    </Col>
                  </Row>
                </div>

                <div className="user-card-actions">
                  <Button size="small" type="link">Edit</Button>
                  <Button size="small" type="link">View</Button>
                  <Button size="small" type="link" icon={<MoreOutlined />} />
                </div>
              </Card>
            </List.Item>
          )}
        />
      </div>
    );
  }

  // Desktop/Tablet table view
  return (
    <Table
      columns={columns}
      dataSource={users}
      scroll={{ x: isTablet ? 1000 : undefined }}
      size={isTablet ? 'small' : 'middle'}
    />
  );
};
```

### Manager Team Management - Responsive Layout
```typescript
const ResponsiveTeamManagement: React.FC = () => {
  const { xs, sm, md, lg } = useBreakpoint();
  const isMobile = xs;
  const isTablet = sm;

  return (
    <div className="team-management-container">
      {/* Responsive team stats */}
      <Row gutter={[16, 16]} className="team-stats">
        <Col xs={24} sm={12} md={6}>
          <Statistic
            title="Team Size"
            value={teamStats.size}
            prefix={<TeamOutlined />}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Statistic
            title="Active Requests"
            value={teamStats.activeRequests}
            valueStyle={{ color: '#faad14' }}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Statistic
            title="Monthly Expense"
            value={teamStats.expense}
            prefix="CHF"
            precision={2}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <div className="budget-indicator">
            <Typography.Text strong>Budget Usage</Typography.Text>
            <Progress
              percent={budgetUsage}
              size={isMobile ? 'default' : 'small'}
              strokeColor={budgetUsage > 80 ? '#ff4d4f' : '#52c41a'}
            />
          </div>
        </Col>
      </Row>

      {/* Team members list */}
      <Card
        title="Team Members"
        className="team-members-card"
        extra={
          !isMobile && (
            <Space>
              <Select size="small" defaultValue="name" style={{ width: 100 }}>
                <Option value="name">Name</Option>
                <Option value="expense">Expense</Option>
                <Option value="requests">Requests</Option>
              </Select>
              <Button size="small">Team Report</Button>
            </Space>
          )
        }
      >
        {isMobile ? (
          // Mobile: Card-based list
          <List
            dataSource={teamMembers}
            renderItem={(member) => (
              <List.Item className="mobile-team-member">
                <Card size="small">
                  <Row align="middle">
                    <Col span={4}>
                      <Avatar
                        size={40}
                        icon={<UserOutlined />}
                        style={{
                          backgroundColor: member.activeRequests > 0 ? '#52c41a' : '#d9d9d9'
                        }}
                      />
                    </Col>
                    <Col span={14}>
                      <div>
                        <Typography.Text strong>{member.name}</Typography.Text>
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                          {member.email}
                        </div>
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                          {member.department} • {member.activeRequests} active requests
                        </div>
                      </div>
                    </Col>
                    <Col span={6} style={{ textAlign: 'right' }}>
                      <Typography.Text strong>
                        CHF {member.monthlyExpense}
                      </Typography.Text>
                      <div style={{ fontSize: 10, color: '#8c8c8c' }}>
                        {member.lastRequestDate ? dayjs(member.lastRequestDate).fromNow() : 'No requests'}
                      </div>
                    </Col>
                  </Row>
                </Card>
              </List.Item>
            )}
          />
        ) : (
          // Desktop/Tablet: Traditional list
          <List
            dataSource={teamMembers}
            renderItem={(member) => (
              <List.Item actions={[
                <Button size="small">View Profile</Button>,
                <Button size="small">Edit</Button>
              ]}>
                <List.Item.Meta
                  avatar={<Avatar size={40} icon={<UserOutlined />} />}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Typography.Text strong>{member.name}</Typography.Text>
                      <Tag color="blue" size="small">Employee</Tag>
                    </div>
                  }
                  description={
                    <div>
                      <div>{member.email} | {member.department}</div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Home: {member.homeCity} | Active Requests: {member.activeRequests}
                      </Typography.Text>
                    </div>
                  }
                />
                <div style={{ textAlign: 'right' }}>
                  <Typography.Text strong>CHF {member.monthlyExpense}</Typography.Text>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                    Last request: {member.lastRequestDate ?
                      dayjs(member.lastRequestDate).fromNow() : 'Never'}
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* Mobile floating action button */}
      {isMobile && (
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<PlusOutlined />}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            zIndex: 1000
          }}
          onClick={() => console.log('Add team member')}
        />
      )}
    </div>
  );
};
```

### Mobile-Specific User Management Patterns
```scss
// Mobile user management styles
@media (max-width: 768px) {
  .mobile-user-management {
    .mobile-search {
      position: sticky;
      top: 64px; // Below header
      background: white;
      z-index: 10;
      padding: 16px;
      border-bottom: 1px solid #f0f0f0;
    }

    .mobile-filters {
      padding: 0 16px 16px;
      background: white;
    }

    .user-card {
      margin-bottom: 8px;

      .user-card-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;

        .user-info {
          flex: 1;
          min-width: 0;

          .ant-typography {
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }

      .user-card-details {
        margin-bottom: 12px;

        .ant-row {
          font-size: 12px;
        }
      }

      .user-card-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding-top: 8px;
        border-top: 1px solid #f0f0f0;
      }
    }
  }

  // Team management mobile styles
  .team-management-container {
    .team-stats {
      .ant-statistic {
        text-align: center;

        .ant-statistic-title {
          font-size: 12px;
        }

        .ant-statistic-content {
          font-size: 20px;
        }
      }
    }

    .mobile-team-member {
      .ant-card-body {
        padding: 12px;
      }
    }
  }

  // Registration form mobile styles - ELCA CI/CD
  .registration-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);

    .registration-card {
      border-radius: 0;
      box-shadow: none;
      border: none;
      min-height: 100vh;
      border-top: 4px solid #e74c3c; // ELCA coral-red accent

      .ant-card-body {
        padding: 24px 20px;
      }
    }

    .registration-header {
      text-align: center;
      margin-bottom: 32px;

      .elca-logo-container {
        margin-bottom: 16px;

        .elca-logo {
          height: 48px;
          width: 48px;
        }
      }

      .elca-heading {
        color: #e74c3c !important; // ELCA coral-red
        font-weight: 600;
      }
    }

    .password-strength-container {
      margin-bottom: 16px;

      .strength-fill {
        &.very-weak { background: #e74c3c !important; } // ELCA coral-red for weak
        &.weak { background: #f39c12; }
        &.fair { background: #f1c40f; }
        &.good { background: #27ae60; }
        &.strong { background: #229954; }
      }
    }
  }

  // Touch-friendly enhancements with ELCA styling
  .ant-input,
  .ant-select-selector,
  .ant-btn {
    min-height: 44px;
    border-radius: 6px;
  }

  .ant-btn-primary {
    background: #e74c3c !important; // ELCA coral-red
    border-color: #e74c3c !important;
    box-shadow: 0 2px 4px rgba(231, 76, 60, 0.3);

    &:hover {
      background: #c0392b !important; // Darker ELCA coral-red
      border-color: #c0392b !important;
      box-shadow: 0 4px 8px rgba(231, 76, 60, 0.4);
    }

    &:active {
      background: #a93226 !important;
      border-color: #a93226 !important;
    }
  }

  .ant-form-item-label {
    padding-bottom: 8px;
  }

  .ant-form-item {
    margin-bottom: 20px;
  }

  // Swipe gestures for user cards
  .user-card,
  .mobile-team-member .ant-card {
    position: relative;
    transition: transform 0.2s ease;

    &.swiping {
      transform: translateX(-80px);
    }

    &::after {
      content: 'Edit';
      position: absolute;
      right: -80px;
      top: 0;
      bottom: 0;
      width: 80px;
      background: #1677ff;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    &.swiping::after {
      opacity: 1;
    }
  }
}
```

## Implementation Checklist

### Phase 1: Foundation
- [ ] Set up Ant Design responsive grid system
- [ ] Implement mobile-first CSS architecture
- [ ] Create responsive layout components
- [ ] Test across device breakpoints

### Phase 2: Components
- [ ] Convert all forms to responsive layouts
- [ ] Implement mobile card views for data tables
- [ ] Add touch-friendly interaction patterns
- [ ] Optimize navigation for mobile

### Phase 3: Enhancement
- [ ] Add gesture support for mobile interactions
- [ ] Implement progressive image loading
- [ ] Add pull-to-refresh functionality
- [ ] Optimize performance for mobile devices

### Phase 4: Testing & Validation
- [ ] Cross-device testing on real devices
- [ ] Performance testing on slow networks
- [ ] Accessibility testing across screen sizes
- [ ] User testing for mobile experience

This comprehensive responsive design guide ensures the RegularTravelManager application provides an optimal experience across all devices, from mobile phones to large desktop screens, while maintaining performance and accessibility standards.