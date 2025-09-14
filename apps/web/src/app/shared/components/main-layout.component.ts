import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { BreakpointObserver, Breakpoints, LayoutModule } from '@angular/cdk/layout';
import { Observable, Subject } from 'rxjs';
import { map, shareReplay, takeUntil } from 'rxjs/operators';
import { AuthService, User } from '../../core/services/auth.service';
import { LoadingService } from '../../core/services/loading.service';

interface NavigationItem {
  icon: string;
  label: string;
  route: string | ((role: string) => string);
  roles: ('employee' | 'manager' | 'admin')[];
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatBadgeModule,
    MatTooltipModule,
    MatDividerModule,
    LayoutModule,
  ],
  template: `
    <mat-sidenav-container class="sidenav-container" [class.is-mobile]="isHandset$ | async">
      <mat-sidenav
        #drawer
        class="sidenav"
        fixedInViewport
        [attr.role]="(isHandset$ | async) ? 'dialog' : 'navigation'"
        [mode]="(isHandset$ | async) ? 'over' : 'side'"
        [opened]="(isHandset$ | async) === false"
      >
        <mat-toolbar class="sidenav-header">
          <div class="elca-logo"></div>
          <span class="app-title">RTM</span>
        </mat-toolbar>

        <mat-nav-list>
          <ng-container *ngFor="let item of navigationItems">
            <a
              *ngIf="canShowNavItem(item, currentUser$ | async)"
              mat-list-item
              [routerLink]="getRouteForItem(item, (currentUser$ | async)?.role || 'employee')"
              routerLinkActive="active-nav-item"
              [matTooltip]="item.label"
              matTooltipPosition="right"
            >
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          </ng-container>

          <mat-divider></mat-divider>

          <a mat-list-item (click)="logout()">
            <mat-icon matListItemIcon color="warn">logout</mat-icon>
            <span matListItemTitle>Sign Out</span>
          </a>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar color="primary" class="main-toolbar">
          <button
            type="button"
            aria-label="Toggle sidenav"
            mat-icon-button
            (click)="drawer.toggle()"
            *ngIf="isHandset$ | async"
          >
            <mat-icon aria-label="Side nav toggle icon">menu</mat-icon>
          </button>

          <span class="toolbar-title">{{ getPageTitle() }}</span>

          <span class="toolbar-spacer"></span>

          <button mat-icon-button [matMenuTriggerFor]="userMenu">
            <mat-icon>account_circle</mat-icon>
          </button>

          <mat-menu #userMenu="matMenu">
            <div class="user-menu-header" mat-menu-item disabled>
              <div class="user-info">
                <div class="user-name">{{ (currentUser$ | async)?.name }}</div>
                <div class="user-role">{{ (currentUser$ | async)?.role | titlecase }}</div>
              </div>
            </div>
            <mat-divider></mat-divider>
            <button mat-menu-item>
              <mat-icon>settings</mat-icon>
              <span>Settings</span>
            </button>
            <button mat-menu-item (click)="logout()">
              <mat-icon color="warn">logout</mat-icon>
              <span>Sign Out</span>
            </button>
          </mat-menu>
        </mat-toolbar>

        <main class="main-content">
          <router-outlet></router-outlet>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styleUrls: ['./main-layout.component.scss'],
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset).pipe(
    map(result => result.matches),
    shareReplay()
  );

  currentUser$ = this.authService.getCurrentUser();

  navigationItems: NavigationItem[] = [
    {
      icon: 'dashboard',
      label: 'Dashboard',
      route: (role: string) => (role === 'manager' ? '/manager/dashboard' : '/employee/dashboard'),
      roles: ['employee', 'manager'],
    },
    {
      icon: 'home',
      label: 'Address',
      route: (role: string) => (role === 'manager' ? '/employee/address' : '/employee/address'), // Both use employee address for now
      roles: ['employee', 'manager'],
    },
    {
      icon: 'add_circle',
      label: 'New Request',
      route: (role: string) => (role === 'manager' ? '/employee/request' : '/employee/request'), // Both use employee request for now
      roles: ['employee', 'manager'],
    },
    {
      icon: 'check_circle',
      label: 'Approvals',
      route: '/manager/approvals',
      roles: ['manager'],
    },
    {
      icon: 'people',
      label: 'Employees',
      route: '/manager/employees',
      roles: ['manager'],
    },
    {
      icon: 'work',
      label: 'Projects',
      route: '/manager/projects',
      roles: ['manager'],
    },
    {
      icon: 'admin_panel_settings',
      label: 'Manage Projects',
      route: '/admin/projects',
      roles: ['admin'],
    },
  ];

  constructor(
    private breakpointObserver: BreakpointObserver,
    private authService: AuthService,
    private loadingService: LoadingService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Auto-redirect if not authenticated
    this.authService.isAuthenticated$.pipe(takeUntil(this.destroy$)).subscribe(isAuth => {
      if (!isAuth) {
        this.router.navigate(['/login']);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  canShowNavItem(item: NavigationItem, user: User | null): boolean {
    return user ? item.roles.includes(user.role) : false;
  }

  getRouteForItem(item: NavigationItem, role: string): string {
    return typeof item.route === 'function' ? item.route(role) : item.route;
  }

  getPageTitle(): string {
    const url = this.router.url;

    if (url.includes('/dashboard')) return 'Dashboard';
    if (url.includes('/address')) return 'My Address';
    if (url.includes('/request')) return 'Travel Request';
    if (url.includes('/approvals')) return 'Approvals';
    if (url.includes('/employees')) return 'Employees';
    if (url.includes('/projects')) return 'Projects';

    return 'RegularTravelManager';
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.loadingService.resetLoading();
        this.router.navigate(['/login']);
      },
      error: error => {
        console.error('Logout error:', error);
        this.loadingService.resetLoading();
        // Navigate anyway in case of error
        this.router.navigate(['/login']);
      },
    });
  }
}
