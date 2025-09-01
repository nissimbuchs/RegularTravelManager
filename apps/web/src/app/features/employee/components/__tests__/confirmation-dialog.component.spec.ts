import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ConfirmationDialogComponent, ConfirmationData } from '../confirmation-dialog.component';

describe('ConfirmationDialogComponent', () => {
  let component: ConfirmationDialogComponent;
  let fixture: ComponentFixture<ConfirmationDialogComponent>;
  let mockDialogRef: jasmine.SpyObj<MatDialogRef<ConfirmationDialogComponent>>;

  const mockData: ConfirmationData = {
    requestId: 'req-12345',
    calculationPreview: {
      distance: 45.25,
      dailyAllowance: 30.75,
      weeklyAllowance: 153.75,
    },
    projectName: 'Test Project',
    subprojectName: 'Test Subproject',
    managerName: 'Test Manager',
    daysPerWeek: 5,
    justification: 'This is a test justification for the travel request',
  };

  beforeEach(async () => {
    const dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [ConfirmationDialogComponent, BrowserAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: mockData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmationDialogComponent);
    component = fixture.componentInstance;
    mockDialogRef = TestBed.inject(MatDialogRef) as jasmine.SpyObj<
      MatDialogRef<ConfirmationDialogComponent>
    >;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display correct request ID', () => {
    fixture.detectChanges();
    const requestIdElement = fixture.nativeElement.querySelector('.request-id');
    expect(requestIdElement.textContent).toContain('req-12345');
  });

  it('should display calculation preview correctly', () => {
    fixture.detectChanges();
    const summaryItems = fixture.nativeElement.querySelectorAll('.summary-item .value');

    expect(summaryItems[0].textContent).toContain('45.250 km');
    expect(summaryItems[1].textContent).toContain('CHF 30.75');
    expect(summaryItems[2].textContent).toContain('CHF 153.75');
  });

  it('should display request details correctly', () => {
    fixture.detectChanges();
    const detailItems = fixture.nativeElement.querySelectorAll('.detail-item .value');

    expect(detailItems[0].textContent).toContain('Test Project');
    expect(detailItems[1].textContent).toContain('Test Subproject');
    expect(detailItems[2].textContent).toContain('Test Manager');
    expect(detailItems[3].textContent).toContain('5');
  });

  it('should display justification correctly', () => {
    fixture.detectChanges();
    const justificationElement = fixture.nativeElement.querySelector('.justification-text');
    expect(justificationElement.textContent).toContain(
      'This is a test justification for the travel request'
    );
  });

  it('should close dialog on close button click', () => {
    component.onClose();
    expect(mockDialogRef.close).toHaveBeenCalledWith();
  });

  it('should close dialog with view-requests result on view requests button click', () => {
    component.onViewRequests();
    expect(mockDialogRef.close).toHaveBeenCalledWith('view-requests');
  });

  it('should close dialog with create-new result on create new button click', () => {
    component.onCreateNew();
    expect(mockDialogRef.close).toHaveBeenCalledWith('create-new');
  });

  it('should render all action buttons', () => {
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.dialog-actions button');

    expect(buttons.length).toBe(3);
    expect(buttons[0].textContent.trim()).toBe('Close');
    expect(buttons[1].textContent.trim()).toBe('View My Requests');
    expect(buttons[2].textContent.trim()).toBe('Create New Request');
  });
});
