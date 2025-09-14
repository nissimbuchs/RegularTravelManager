import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UserRegistrationComponent } from './components/user-registration.component';
import { EmailVerificationComponent } from './components/email-verification.component';

const routes: Routes = [
  {
    path: 'register',
    component: UserRegistrationComponent,
    data: {
      title: 'Register - RegularTravelManager',
      description: 'Create your RegularTravelManager account',
    },
  },
  {
    path: 'verify-email',
    component: EmailVerificationComponent,
    data: {
      title: 'Email Verification - RegularTravelManager',
      description: 'Verify your email address to complete registration',
    },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AuthRoutingModule {}
