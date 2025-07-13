import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import en from '@/translations/en';
import cs from '@/translations/cs';
import de from '@/translations/de';
import es from '@/translations/es';
import fr from '@/translations/fr';
import zh from '@/translations/zh';

describe('Authentication Translation Keys', () => {
  it('should have all required auth translation keys in English', () => {
    expect(en.auth.signIn).toBe('Sign In');
    expect(en.auth.signUp).toBe('Sign Up');
    expect(en.auth.signInToAccount).toBe('Sign in to your account');
    expect(en.auth.accessPlatform).toBe('Access the spheroid segmentation platform');
    expect(en.auth.emailAddressLabel).toBe('Email address');
    expect(en.auth.passwordLabel).toBe('Password');
    expect(en.auth.rememberMe).toBe('Remember me');
    expect(en.auth.forgotPassword).toBe('Forgot Password?');
    expect(en.auth.dontHaveAccount).toBe("Don't have an account?");
    expect(en.auth.alreadyLoggedInTitle).toBe("You're already logged in");
    expect(en.auth.goToDashboardLink).toBe('Go to Dashboard');
  });

  it('should have all required auth translation keys in Czech', () => {
    expect(cs.auth.signIn).toBe('Přihlásit se');
    expect(cs.auth.signUp).toBe('Registrovat se');
    expect(cs.auth.signInToAccount).toBe('Přihlášení k účtu');
    expect(cs.auth.emailAddressLabel).toBe('E-mailová adresa');
    expect(cs.auth.passwordLabel).toBe('Heslo');
    expect(cs.auth.rememberMe).toBe('Zapamatovat si mě');
    expect(cs.auth.dontHaveAccount).toBe('Nemáte účet?');
  });

  it('should have all required auth translation keys in German', () => {
    expect(de.auth.signIn).toBe('Anmelden');
    expect(de.auth.signUp).toBe('Registrieren');
    expect(de.auth.signInToAccount).toBe('Bei Ihrem Konto anmelden');
    expect(de.auth.emailAddressLabel).toBe('E-Mail-Adresse');
    expect(de.auth.passwordLabel).toBe('Passwort');
    expect(de.auth.rememberMe).toBe('Angemeldet bleiben');
    expect(de.auth.dontHaveAccount).toBe('Haben Sie kein Konto?');
  });

  it('should have all required auth translation keys in Spanish', () => {
    expect(es.auth.signIn).toBe('Iniciar sesión');
    expect(es.auth.signUp).toBe('Registrarse');
    expect(es.auth.signInToAccount).toBe('Iniciar sesión en tu cuenta');
    expect(es.auth.emailAddressLabel).toBe('Dirección de correo electrónico');
    expect(es.auth.passwordLabel).toBe('Contraseña');
    expect(es.auth.rememberMe).toBe('Recordarme');
    expect(es.auth.dontHaveAccount).toBe('¿No tienes una cuenta?');
  });

  it('should have all required auth translation keys in French', () => {
    expect(fr.auth.signIn).toBe('Se connecter');
    expect(fr.auth.signUp).toBe("S'inscrire");
    expect(fr.auth.signInToAccount).toBe('Connectez-vous à votre compte');
    expect(fr.auth.passwordLabel).toBe('Mot de passe');
    expect(fr.auth.rememberMe).toBe('Se souvenir de moi');
    expect(fr.auth.dontHaveAccount).toBe("Vous n'avez pas de compte?");
  });

  it('should have all required auth translation keys in Chinese', () => {
    expect(zh.auth.signIn).toBe('登录');
    expect(zh.auth.signUp).toBe('注册');
    expect(zh.auth.signInToAccount).toBe('登录您的账户');
    expect(zh.auth.passwordLabel).toBe('密码');
    expect(zh.auth.rememberMe).toBe('记住我');
    expect(zh.auth.dontHaveAccount).toBe('没有账户？');
  });
});
