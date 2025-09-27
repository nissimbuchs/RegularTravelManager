import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, RouterModule, NavigationEnd } from '@angular/router';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
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
import { map, shareReplay, takeUntil, filter } from 'rxjs/operators';
import { AuthService, User } from '../../core/services/auth.service';
import { LoadingService } from '../../core/services/loading.service';
import { TranslationService } from '../../core/services/translation.service';
import { LanguageSwitcherComponent } from './language-switcher/language-switcher.component';

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
    LanguageSwitcherComponent,
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
          <span class="app-title">{{ translationService.translateSync('layout.sidenav.app_title') }}</span>
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
              <span matListItemTitle>{{ translationService.translateSync(item.label) }}</span>
            </a>
          </ng-container>

          <mat-divider></mat-divider>

          <a mat-list-item (click)="logout()">
            <mat-icon matListItemIcon color="warn">logout</mat-icon>
            <span matListItemTitle>{{ translationService.translateSync('layout.navigation.sign_out') }}</span>
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

          <span class="app-title">{{ translationService.translateSync('layout.header.app_title') }}</span>

          <span class="toolbar-spacer"></span>

          <span class="page-title">{{ getPageTitle() }}</span>

          <span class="toolbar-spacer"></span>

          <!-- Language Switcher -->
          <app-language-switcher class="language-switcher-toolbar"></app-language-switcher>

          <button mat-button [matMenuTriggerFor]="userMenu" class="user-menu-trigger">
            <mat-icon>account_circle</mat-icon>
            <mat-icon>arrow_drop_down</mat-icon>
          </button>

          <mat-menu #userMenu="matMenu">
            <div class="user-menu-header" mat-menu-item disabled>
              <div class="user-info">
                <div class="user-full-name">{{ (currentUser$ | async)?.name }}</div>
                <div class="user-role">{{ translationService.translateSync('layout.user_menu.role.' + ((currentUser$ | async)?.role || 'employee')) }}</div>
              </div>
            </div>
            <mat-divider></mat-divider>
            <button mat-menu-item routerLink="/profile">
              <mat-icon>person</mat-icon>
              <span>{{ translationService.translateSync('layout.user_menu.my_profile') }}</span>
            </button>
            <button mat-menu-item routerLink="/employee/address">
              <mat-icon>home</mat-icon>
              <span>{{ translationService.translateSync('layout.user_menu.my_address') }}</span>
            </button>
            <button mat-menu-item>
              <mat-icon>settings</mat-icon>
              <span>{{ translationService.translateSync('layout.user_menu.settings') }}</span>
            </button>
            <mat-divider></mat-divider>
            <button mat-menu-item (click)="logout()">
              <mat-icon color="warn">logout</mat-icon>
              <span>{{ translationService.translateSync('layout.user_menu.sign_out') }}</span>
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

  @ViewChild('drawer') drawer!: MatSidenav;

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset).pipe(
    map(result => result.matches),
    shareReplay()
  );

  currentUser$ = this.authService.getCurrentUser();

  navigationItems: NavigationItem[] = [
    {
      icon: 'dashboard',
      label: 'layout.navigation.dashboard',
      route: (role: string) => (role === 'manager' ? '/manager/dashboard' : '/employee/dashboard'),
      roles: ['employee', 'manager'],
    },
    {
      icon: 'account_circle',
      label: 'layout.navigation.profile',
      route: '/profile',
      roles: ['employee', 'manager', 'admin'],
    },
    {
      icon: 'home',
      label: 'layout.navigation.address',
      route: (role: string) => (role === 'manager' ? '/employee/address' : '/employee/address'), // Both use employee address for now
      roles: ['employee', 'manager'],
    },
    {
      icon: 'add_circle',
      label: 'layout.navigation.new_request',
      route: (role: string) => (role === 'manager' ? '/employee/request' : '/employee/request'), // Both use employee request for now
      roles: ['employee', 'manager'],
    },
    {
      icon: 'check_circle',
      label: 'layout.navigation.approvals',
      route: '/manager/approvals',
      roles: ['manager'],
    },
    {
      icon: 'people',
      label: 'layout.navigation.employees',
      route: '/manager/employees',
      roles: ['manager'],
    },
    {
      icon: 'work',
      label: 'layout.navigation.projects',
      route: '/manager/projects',
      roles: ['manager'],
    },
    {
      icon: 'admin_panel_settings',
      label: 'layout.navigation.manage_projects',
      route: '/admin/projects',
      roles: ['admin'],
    },
    {
      icon: 'group',
      label: 'layout.navigation.manage_users',
      route: '/admin/users',
      roles: ['admin'],
    },
  ];

  constructor(
    private breakpointObserver: BreakpointObserver,
    private authService: AuthService,
    private loadingService: LoadingService,
    private router: Router,
    public translationService: TranslationService
  ) {}

  ngOnInit(): void {
    // Auto-redirect if not authenticated
    this.authService.isAuthenticated$.pipe(takeUntil(this.destroy$)).subscribe(isAuth => {
      if (!isAuth) {
        this.router.navigate(['/login']);
      }
    });

    // Close sidenav on navigation for mobile devices
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.isHandset$.pipe(takeUntil(this.destroy$)).subscribe(isHandset => {
          if (isHandset && this.drawer) {
            this.drawer.close();
          }
        });
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

    if (url.includes('/dashboard')) return this.translationService.translateSync('layout.page_titles.dashboard');
    if (url.includes('/profile')) return this.translationService.translateSync('layout.page_titles.my_profile');
    if (url.includes('/address')) return this.translationService.translateSync('layout.page_titles.my_address');
    if (url.includes('/request')) return this.translationService.translateSync('layout.page_titles.travel_request');
    if (url.includes('/approvals')) return this.translationService.translateSync('layout.page_titles.approvals');
    if (url.includes('/employees')) return this.translationService.translateSync('layout.page_titles.employees');
    if (url.includes('/projects')) return this.translationService.translateSync('layout.page_titles.projects');
    if (url.includes('/users')) return this.translationService.translateSync('layout.page_titles.users');

    return this.translationService.translateSync('layout.page_titles.default');
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
