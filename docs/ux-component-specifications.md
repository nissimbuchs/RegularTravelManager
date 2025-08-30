# Angular Material Component Specifications - RegularTravelManager

**Date:** 2025-08-30
**Created by:** UX Design Session via Claude Code
**Design System:** Angular Material v17.x
**Framework:** Angular 17+ with TypeScript

## Overview

This document provides detailed component specifications for the RegularTravelManager application using Angular Material. Each component includes configuration, styling, behavior, and implementation examples aligned with the wireframes and user journeys.

## Design Token System

### Color Palette
```typescript
// Custom Angular Material Theme
@use '@angular/material' as mat;

$primary-palette: mat.define-palette(mat.$blue-palette, 600);
$accent-palette: mat.define-palette(mat.$orange-palette, A200);
$warn-palette: mat.define-palette(mat.$red-palette);

$theme: mat.define-light-theme((
  color: (
    primary: $primary-palette,
    accent: $accent-palette,
    warn: $warn-palette,
  ),
  typography: mat.define-typography-config(),
  density: 0,
));

// Custom CSS variables for Swiss business theme
:root {
  --color-primary: #1976d2;        // Material blue
  --color-success: #4caf50;        // Green for approved
  --color-warning: #ff9800;        // Orange for pending
  --color-error: #f44336;          // Red for rejected
  
  // Semantic colors
  --color-bg-container: #ffffff;   // Card backgrounds
  --color-bg-layout: #fafafa;      // Page background
  --color-text-primary: #212121;   // Primary text
  --color-text-secondary: #757575; // Secondary text
  
  // Swiss CHF brand accent
  --color-link: #0066cc;           // Professional blue
  
  // Spacing system (following Material Design 8px grid)
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
}
```

### Typography Scale
```typescript
const typography = {
  // Page titles
  h1: { fontSize: '28px', fontWeight: 600, lineHeight: 1.2 },
  
  // Section titles  
  h2: { fontSize: '20px', fontWeight: 600, lineHeight: 1.3 },
  
  // Card titles
  h3: { fontSize: '16px', fontWeight: 600, lineHeight: 1.4 },
  
  // Body text
  body: { fontSize: '14px', fontWeight: 400, lineHeight: 1.5 },
  
  // Small text
  caption: { fontSize: '12px', fontWeight: 400, lineHeight: 1.4 },
};
```

---

## Layout Components

### 1. Application Layout

**Component:** `Layout`, `Layout.Header`, `Layout.Sider`, `Layout.Content`

```typescript
interface AppLayoutProps {
  user: User;
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ user, children }) => {
  const [collapsed, setCollapsed] = useState(false);
  
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header className="app-header">
        <div className="header-left">
          <Button 
            type="text" 
            icon={<MenuOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="mobile-menu-trigger"
          />
          <div className="logo">RegularTravelManager</div>
        </div>
        <div className="header-right">
          <Badge count={3} size="small">
            <Button type="text" icon={<BellOutlined />} />
          </Badge>
          <Dropdown menu={{ items: userMenuItems }}>
            <Button type="text" className="user-menu">
              {user.name} <DownOutlined />
            </Button>
          </Dropdown>
        </div>
      </Layout.Header>
      
      <Layout>
        <Layout.Sider 
          collapsed={collapsed}
          breakpoint="lg"
          collapsedWidth="0"
          onBreakpoint={setCollapsed}
        >
          <NavigationMenu userRole={user.role} />
        </Layout.Sider>
        
        <Layout.Content className="main-content">
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  );
};
```

**Styling:**
```css
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  font-size: 18px;
  font-weight: 600;
  color: #1677ff;
}

.mobile-menu-trigger {
  display: none;
}

@media (max-width: 992px) {
  .mobile-menu-trigger {
    display: inline-flex;
  }
}

.main-content {
  padding: 24px;
  background: #f5f5f5;
}
```

---

## Navigation Components

### 2. Navigation Menu

**Component:** `Menu`

```typescript
interface NavigationMenuProps {
  userRole: 'employee' | 'manager';
}

const NavigationMenu: React.FC<NavigationMenuProps> = ({ userRole }) => {
  const location = useLocation();
  
  const employeeMenuItems = [
    {
      key: '/dashboard',
      icon: <HomeOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/requests/new',
      icon: <PlusOutlined />,
      label: 'New Request',
    },
    {
      key: '/requests',
      icon: <FileTextOutlined />,
      label: 'My Requests',
    },
    {
      key: '/profile',
      icon: <UserOutlined />,
      label: 'Profile',
    },
  ];

  const managerMenuItems = [
    {
      key: '/dashboard',
      icon: <HomeOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/employees',
      icon: <TeamOutlined />,
      label: 'Employee Search',
    },
    {
      key: '/approvals',
      icon: <CheckCircleOutlined />,
      label: 'Pending Approvals',
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: 'Decision History',
    },
  ];

  const menuItems = userRole === 'manager' ? managerMenuItems : employeeMenuItems;
  
  return (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={menuItems}
      style={{ height: '100%', borderRight: 0 }}
    />
  );
};
```

---

## Form Components

### 3. Travel Request Form

**Component:** `Form`, `Select`, `InputNumber`, `Input.TextArea`

```typescript
interface TravelRequestFormProps {
  onSubmit: (values: TravelRequestData) => Promise<void>;
  initialValues?: Partial<TravelRequestData>;
}

const TravelRequestForm: React.FC<TravelRequestFormProps> = ({ 
  onSubmit, 
  initialValues 
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  const [calculatedAllowance, setCalculatedAllowance] = useState<number>(0);

  const handleProjectChange = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    setSubprojects(project?.subprojects || []);
    form.setFieldsValue({ subprojectId: undefined });
  };

  const handleSubmit = async (values: TravelRequestFormData) => {
    setLoading(true);
    try {
      await onSubmit(values);
      message.success('Travel request submitted successfully');
      form.resetFields();
    } catch (error) {
      message.error('Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Submit Travel Allowance Request" className="request-form-card">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={initialValues}
        requiredMark="optional"
      >
        <Divider orientation="left">Project Information</Divider>
        
        <Form.Item
          name="projectId"
          label="Project"
          rules={[{ required: true, message: 'Please select a project' }]}
        >
          <Select
            showSearch
            placeholder="Select a project"
            optionFilterProp="children"
            onChange={handleProjectChange}
            loading={!projects.length}
          >
            {projects.map(project => (
              <Select.Option key={project.id} value={project.id}>
                {project.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="subprojectId"
          label="Subproject"
          rules={[{ required: true, message: 'Please select a subproject' }]}
        >
          <Select
            placeholder="Select a subproject"
            disabled={!subprojects.length}
          >
            {subprojects.map(subproject => (
              <Select.Option key={subproject.id} value={subproject.id}>
                {subproject.name} - {subproject.location}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {calculatedAllowance > 0 && (
          <Alert
            message="Distance Calculation"
            description={`Estimated distance: 45km | Rate: CHF 2.50/km | Daily allowance: CHF ${calculatedAllowance}`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Divider orientation="left">Request Details</Divider>

        <Form.Item
          name="daysPerWeek"
          label="Days per Week"
          rules={[{ required: true, message: 'Please select days per week' }]}
        >
          <Radio.Group>
            {[1, 2, 3, 4, 5].map(day => (
              <Radio.Button key={day} value={day}>
                {day}
              </Radio.Button>
            ))}
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="managerName"
          label="Approving Manager"
          rules={[{ required: true, message: 'Please enter manager name' }]}
        >
          <AutoComplete
            placeholder="Type manager name"
            options={managerSuggestions}
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
            { min: 20, message: 'Please provide at least 20 characters' }
          ]}
        >
          <Input.TextArea
            rows={4}
            placeholder="Explain why travel allowance is necessary for this project..."
            showCount
            maxLength={500}
          />
        </Form.Item>

        {calculatedAllowance > 0 && (
          <Card size="small" className="allowance-summary">
            <Statistic
              title="Weekly Allowance"
              value={calculatedAllowance * form.getFieldValue('daysPerWeek')}
              prefix="CHF"
              precision={2}
            />
            <Statistic
              title="Monthly Estimate"
              value={calculatedAllowance * form.getFieldValue('daysPerWeek') * 4}
              prefix="CHF"
              precision={2}
            />
          </Card>
        )}

        <Form.Item style={{ marginTop: 32 }}>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
            >
              Submit Request
            </Button>
            <Button
              size="large"
              onClick={() => form.resetFields()}
            >
              Reset Form
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};
```

**Styling:**
```css
.request-form-card {
  max-width: 800px;
  margin: 0 auto;
}

.allowance-summary {
  background: #f6ffed;
  border-color: #b7eb8f;
}

.allowance-summary .ant-statistic {
  text-align: center;
}

@media (max-width: 768px) {
  .request-form-card {
    margin: 0;
  }
  
  .ant-radio-group .ant-radio-button-wrapper {
    width: 20%;
    text-align: center;
  }
}
```

---

## Data Display Components

### 4. Request Status Card

**Component:** `Card`, `Tag`, `Typography`, `Button`

```typescript
interface RequestStatusCardProps {
  request: TravelRequest;
  showActions?: boolean;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onCancel?: (id: string) => void;
}

const RequestStatusCard: React.FC<RequestStatusCardProps> = ({
  request,
  showActions = true,
  onView,
  onEdit,
  onCancel
}) => {
  const getStatusTag = (status: RequestStatus) => {
    const statusConfig = {
      pending: { color: 'processing', text: 'Pending' },
      approved: { color: 'success', text: 'Approved' },
      rejected: { color: 'error', text: 'Rejected' },
    };
    
    const config = statusConfig[status];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const actions = showActions ? [
    <Button key="view" type="link" onClick={() => onView?.(request.id)}>
      View Details
    </Button>,
    ...(request.status === 'pending' ? [
      <Button key="edit" type="link" onClick={() => onEdit?.(request.id)}>
        Edit
      </Button>,
      <Button 
        key="cancel" 
        type="link" 
        danger 
        onClick={() => onCancel?.(request.id)}
      >
        Cancel
      </Button>
    ] : [])
  ] : undefined;

  return (
    <Card
      size="small"
      actions={actions}
      className={`request-card status-${request.status}`}
    >
      <div className="request-header">
        <Typography.Text strong>
          {request.project.name} - {request.subproject.name}
        </Typography.Text>
        {getStatusTag(request.status)}
      </div>
      
      <div className="request-details">
        <Typography.Text type="secondary">
          {request.daysPerWeek} days/week | {request.managerName}
        </Typography.Text>
        <Typography.Text strong>
          CHF {request.weeklyAllowance.toFixed(2)}/week
        </Typography.Text>
      </div>
      
      <div className="request-meta">
        <Typography.Text type="secondary">
          Submitted {dayjs(request.createdAt).fromNow()}
        </Typography.Text>
      </div>
      
      {request.status === 'rejected' && request.rejectionComment && (
        <Alert
          message="Rejection Reason"
          description={request.rejectionComment}
          type="warning"
          size="small"
          style={{ marginTop: 12 }}
        />
      )}
    </Card>
  );
};
```

**Styling:**
```css
.request-card {
  margin-bottom: 16px;
  transition: all 0.2s;
}

.request-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.request-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.request-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.request-meta {
  font-size: 12px;
}

.status-pending {
  border-left: 4px solid #faad14;
}

.status-approved {
  border-left: 4px solid #52c41a;
}

.status-rejected {
  border-left: 4px solid #ff4d4f;
}

@media (max-width: 768px) {
  .request-header {
    flex-direction: column;
    gap: 8px;
  }
  
  .request-details {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
```

---

### 5. Dashboard Statistics

**Component:** `Row`, `Col`, `Statistic`, `Card`

```typescript
interface DashboardStatsProps {
  stats: {
    pending: number;
    approved: number;
    monthlyAllowance: number;
    totalRequests: number;
  };
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ stats }) => {
  return (
    <Row gutter={[16, 16]} className="dashboard-stats">
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="Pending Requests"
            value={stats.pending}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: '#faad14' }}
          />
        </Card>
      </Col>
      
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="Approved This Month"
            value={stats.approved}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="Monthly Allowance"
            value={stats.monthlyAllowance}
            prefix="CHF"
            precision={2}
            valueStyle={{ color: '#1677ff' }}
          />
        </Card>
      </Col>
      
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="Total Requests"
            value={stats.totalRequests}
            prefix={<FileTextOutlined />}
          />
        </Card>
      </Col>
    </Row>
  );
};
```

---

## Manager-Specific Components

### 6. Request Review Panel

**Component:** `Card`, `Descriptions`, `Radio`, `Button`

```typescript
interface RequestReviewPanelProps {
  request: TravelRequest;
  employee: Employee;
  onDecision: (decision: 'approve' | 'reject', comment?: string) => Promise<void>;
}

const RequestReviewPanel: React.FC<RequestReviewPanelProps> = ({
  request,
  employee,
  onDecision
}) => {
  const [decision, setDecision] = useState<'approve' | 'reject'>();
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!decision) return;
    
    if (decision === 'reject' && !comment.trim()) {
      message.error('Please provide a comment for rejection');
      return;
    }

    setLoading(true);
    try {
      await onDecision(decision, comment);
      message.success(`Request ${decision}d successfully`);
    } catch (error) {
      message.error('Failed to process decision');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="review-panel">
      <Card title="Employee Information" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Name">{employee.name}</Descriptions.Item>
          <Descriptions.Item label="Department">{employee.department}</Descriptions.Item>
          <Descriptions.Item label="Home Location">{employee.homeAddress}</Descriptions.Item>
          <Descriptions.Item label="Manager">{employee.managerName}</Descriptions.Item>
        </Descriptions>
        
        <Divider />
        
        <Typography.Text strong>Recent Travel History:</Typography.Text>
        <List
          size="small"
          dataSource={employee.recentRequests}
          renderItem={(item) => (
            <List.Item>
              <Typography.Text>
                {item.projectName}: CHF {item.monthlyAllowance} 
                ({dayjs(item.approvedAt).format('MMM YYYY')})
              </Typography.Text>
            </List.Item>
          )}
        />
      </Card>

      <Card title="Request Details" style={{ marginBottom: 16 }}>
        <Descriptions column={1} size="middle">
          <Descriptions.Item label="Project">
            {request.project.name} - {request.subproject.name}
          </Descriptions.Item>
          <Descriptions.Item label="Location">
            {request.subproject.address}
          </Descriptions.Item>
          <Descriptions.Item label="Distance">
            {request.calculatedDistance} km (straight-line)
          </Descriptions.Item>
          <Descriptions.Item label="Rate">
            CHF {request.ratePerKm}/km
          </Descriptions.Item>
          <Descriptions.Item label="Frequency">
            {request.daysPerWeek} days per week
          </Descriptions.Item>
          <Descriptions.Item label="Weekly Allowance">
            <Typography.Text strong style={{ color: '#1677ff' }}>
              CHF {request.weeklyAllowance.toFixed(2)}
            </Typography.Text>
          </Descriptions.Item>
        </Descriptions>
        
        <Divider />
        
        <Typography.Text strong>Employee Justification:</Typography.Text>
        <Card size="small" style={{ marginTop: 8, background: '#fafafa' }}>
          <Typography.Paragraph>
            {request.justification}
          </Typography.Paragraph>
        </Card>
      </Card>

      <Card title="Decision">
        <Radio.Group
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          style={{ marginBottom: 16 }}
        >
          <Radio value="approve">
            <CheckOutlined style={{ color: '#52c41a' }} /> Approve Request
          </Radio>
          <Radio value="reject">
            <CloseOutlined style={{ color: '#ff4d4f' }} /> Reject Request
          </Radio>
        </Radio.Group>

        {decision === 'reject' && (
          <Form.Item
            label="Rejection Comment"
            required
            style={{ marginBottom: 16 }}
          >
            <Input.TextArea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Please explain why this request is being rejected..."
              rows={3}
              showCount
              maxLength={500}
            />
          </Form.Item>
        )}

        <Space>
          <Button
            type="primary"
            size="large"
            disabled={!decision}
            loading={loading}
            onClick={handleSubmit}
          >
            Submit Decision
          </Button>
          <Button size="large">
            Cancel
          </Button>
        </Space>
      </Card>
    </div>
  );
};
```

---

## Responsive Design Specifications

### Breakpoint System
```typescript
const breakpoints = {
  xs: '(max-width: 575px)',     // Mobile phones
  sm: '(min-width: 576px)',     // Small tablets
  md: '(min-width: 768px)',     // Tablets
  lg: '(min-width: 992px)',     // Small desktops
  xl: '(min-width: 1200px)',    // Large desktops
  xxl: '(min-width: 1600px)',   // Extra large screens
};
```

### Mobile Optimizations
```css
@media (max-width: 768px) {
  /* Stack form elements vertically */
  .ant-form-item {
    margin-bottom: 16px;
  }
  
  /* Larger touch targets */
  .ant-btn {
    min-height: 44px;
    padding: 0 24px;
  }
  
  /* Simplified table views */
  .ant-table-thead {
    display: none;
  }
  
  .ant-table-tbody > tr > td {
    display: block;
    border: none;
    padding: 8px 16px;
  }
  
  .ant-table-tbody > tr {
    border: 1px solid #f0f0f0;
    margin-bottom: 8px;
  }
  
  /* Mobile navigation */
  .ant-layout-sider {
    position: fixed !important;
    height: 100vh;
    z-index: 1000;
  }
  
  /* Sticky action buttons */
  .mobile-actions {
    position: fixed;
    bottom: 16px;
    left: 16px;
    right: 16px;
    z-index: 999;
    background: white;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}
```

---

## Accessibility Implementation

### ARIA Labels and Descriptions
```typescript
// Form accessibility
<Form.Item
  label="Project"
  rules={[{ required: true }]}
>
  <Select
    placeholder="Select a project"
    aria-label="Select project for travel request"
    aria-describedby="project-help"
  >
    {/* options */}
  </Select>
  <div id="project-help" className="ant-form-item-explain">
    Choose the project that requires travel allowance
  </div>
</Form.Item>

// Status indicators with screen reader text
<Tag color="success">
  <span aria-hidden="true">✓</span>
  <span className="sr-only">Status: </span>
  Approved
</Tag>
```

### Keyboard Navigation
```typescript
// Custom focus management
const TravelRequestTable: React.FC = () => {
  const handleKeyDown = (event: KeyboardEvent, record: TravelRequest) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onViewRequest(record.id);
    }
  };

  return (
    <Table
      rowClassName="focusable-row"
      onRow={(record) => ({
        tabIndex: 0,
        onKeyDown: (e) => handleKeyDown(e, record),
        'aria-label': `Travel request for ${record.project.name}`,
      })}
    />
  );
};
```

---

## Performance Optimizations

### Component Lazy Loading
```typescript
// Lazy load heavy components
const RequestReviewPanel = lazy(() => import('./RequestReviewPanel'));
const EmployeeSearchTable = lazy(() => import('./EmployeeSearchTable'));

// Usage with Suspense
<Suspense fallback={<Skeleton active />}>
  <RequestReviewPanel {...props} />
</Suspense>
```

### Virtual Scrolling for Large Lists
```typescript
import { List } from 'react-virtualized';

const VirtualizedRequestList: React.FC<{ requests: TravelRequest[] }> = ({
  requests
}) => {
  const rowRenderer = ({ index, key, style }) => (
    <div key={key} style={style}>
      <RequestStatusCard request={requests[index]} />
    </div>
  );

  return (
    <List
      height={600}
      rowCount={requests.length}
      rowHeight={120}
      rowRenderer={rowRenderer}
    />
  );
};
```

---

## Testing Specifications

### Component Testing with Jest & Testing Library
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TravelRequestForm } from './TravelRequestForm';

describe('TravelRequestForm', () => {
  const mockOnSubmit = jest.fn();
  
  beforeEach(() => {
    render(<TravelRequestForm onSubmit={mockOnSubmit} />);
  });

  it('should render all required form fields', () => {
    expect(screen.getByLabelText(/project/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/subproject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/days per week/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/manager/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/justification/i)).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const user = userEvent.setup();
    
    await user.click(screen.getByRole('button', { name: /submit/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/please select a project/i)).toBeInTheDocument();
    });
  });

  it('should calculate allowance when form is complete', async () => {
    const user = userEvent.setup();
    
    await user.selectOptions(
      screen.getByLabelText(/project/i), 
      'project-1'
    );
    
    await waitFor(() => {
      expect(screen.getByText(/estimated allowance/i)).toBeInTheDocument();
    });
  });
});
```

---

## Implementation Checklist

### Phase 1: Core Components
- [ ] Application Layout with responsive navigation
- [ ] Authentication forms (Login, Password Reset)
- [ ] Dashboard layouts for Employee and Manager
- [ ] Travel Request Form with validation

### Phase 2: Data Display
- [ ] Request Status Cards with actions
- [ ] Dashboard statistics components
- [ ] Employee search and filtering
- [ ] Request review interface

### Phase 3: Advanced Features
- [ ] Real-time notifications
- [ ] Bulk actions for managers
- [ ] Advanced filtering and sorting
- [ ] Export functionality

### Phase 4: Polish & Optimization
- [ ] Accessibility audit and fixes
- [ ] Performance optimization
- [ ] Mobile experience refinement
- [ ] User testing and feedback integration

This comprehensive component specification provides a solid foundation for implementing the RegularTravelManager user interface with Angular Material, ensuring consistency, accessibility, and optimal user experience across all devices and user types.