import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import en from '@/translations/en';
import cs from '@/translations/cs';
import de from '@/translations/de';
import es from '@/translations/es';
import fr from '@/translations/fr';
import zh from '@/translations/zh';

describe('Request Access Translation Keys', () => {
  it('should have all required request access translation keys in English', () => {
    expect(en.requestAccess.title).toBe('Request Access to Spheroid Segmentation Platform');
    expect(en.requestAccess.description).toBe('Fill out the form below to request access to our platform. We will review your request and get back to you soon.');
    expect(en.requestAccess.emailLabel).toBe('Your Email Address');
    expect(en.requestAccess.nameLabel).toBe('Your Name');
    expect(en.requestAccess.institutionLabel).toBe('Institution/Company');
    expect(en.requestAccess.reasonLabel).toBe('Reason for Access');
    expect(en.requestAccess.submitRequest).toBe('Submit Request');
    expect(en.requestAccess.requestReceived).toBe('Request Received');
    expect(en.requestAccess.thankYou).toBe('Thank you for your interest');
    expect(en.requestAccess.weWillContact).toBe('We will review your request and contact you soon');
  });

  it('should have all required request access translation keys in Czech', () => {
    expect(cs.requestAccess.title).toBe('Požádat o přístup k platformě pro segmentaci sféroidů');
    expect(cs.requestAccess.description).toBe('Vyplňte následující formulář pro žádost o přístup k naší platformě. Posoudíme vaši žádost a brzy vás kontaktujeme.');
    expect(cs.requestAccess.emailLabel).toBe('Vaše e-mailová adresa');
    expect(cs.requestAccess.nameLabel).toBe('Vaše jméno');
    expect(cs.requestAccess.institutionLabel).toBe('Instituce/Společnost');
    expect(cs.requestAccess.reasonLabel).toBe('Důvod přístupu');
    expect(cs.requestAccess.submitRequest).toBe('Odeslat žádost');
    expect(cs.requestAccess.requestReceived).toBe('Žádost přijata');
    expect(cs.requestAccess.thankYou).toBe('Děkujeme za váš zájem');
  });

  it('should have all required request access translation keys in German', () => {
    expect(de.requestAccess.title).toBe('Zugriff auf die Spheroid-Segmentierungsplattform anfordern');
    expect(de.requestAccess.emailLabel).toBe('Ihre E-Mail-Adresse');
    expect(de.requestAccess.nameLabel).toBe('Ihr Name');
    expect(de.requestAccess.institutionLabel).toBe('Institution/Firma');
    expect(de.requestAccess.reasonLabel).toBe('Grund für den Zugriff');
    expect(de.requestAccess.submitRequest).toBe('Anfrage senden');
    expect(de.requestAccess.requestReceived).toBe('Anfrage erhalten');
    expect(de.requestAccess.thankYou).toBe('Vielen Dank für Ihr Interesse');
    expect(de.requestAccess.weWillContact).toBe('Wir werden Ihre Anfrage prüfen und uns bald mit Ihnen in Verbindung setzen');
  });

  it('should have all required request access translation keys in Spanish', () => {
    expect(es.requestAccess.title).toBe('Solicitar acceso a la plataforma de segmentación de esferoides');
    expect(es.requestAccess.emailLabel).toBe('Tu dirección de correo electrónico');
    expect(es.requestAccess.nameLabel).toBe('Tu nombre');
    expect(es.requestAccess.institutionLabel).toBe('Institución/Empresa');
    expect(es.requestAccess.reasonLabel).toBe('Motivo del acceso');
    expect(es.requestAccess.submitRequest).toBe('Enviar solicitud');
    expect(es.requestAccess.requestReceived).toBe('Solicitud recibida');
    expect(es.requestAccess.thankYou).toBe('Gracias por tu interés');
    expect(es.requestAccess.weWillContact).toBe('Revisaremos tu solicitud y nos pondremos en contacto contigo pronto');
  });

  it('should have all required request access translation keys in French', () => {
    expect(fr.requestAccess.title).toBe("Demander l'accès à la plateforme de segmentation de sphéroïdes");
    expect(fr.requestAccess.emailLabel).toBe('Votre adresse email');
    expect(fr.requestAccess.nameLabel).toBe('Votre nom');
    expect(fr.requestAccess.institutionLabel).toBe('Institution/Entreprise');
    expect(fr.requestAccess.reasonLabel).toBe("Raison de l'accès");
    expect(fr.requestAccess.submitRequest).toBe('Soumettre la demande');
    expect(fr.requestAccess.requestReceived).toBe('Demande reçue');
    expect(fr.requestAccess.thankYou).toBe('Merci pour votre intérêt');
    expect(fr.requestAccess.weWillContact).toBe('Nous examinerons votre demande et vous contacterons bientôt');
  });

  it('should have all required request access translation keys in Chinese', () => {
    expect(zh.requestAccess.title).toBe('请求访问类器官分割平台');
    expect(zh.requestAccess.emailLabel).toBe('您的电子邮件地址');
    expect(zh.requestAccess.nameLabel).toBe('您的姓名');
    expect(zh.requestAccess.institutionLabel).toBe('机构/公司');
    expect(zh.requestAccess.reasonLabel).toBe('访问原因');
    expect(zh.requestAccess.submitRequest).toBe('提交请求');
    expect(zh.requestAccess.requestReceived).toBe('已收到请求');
    expect(zh.requestAccess.thankYou).toBe('感谢您的关注');
    expect(zh.requestAccess.weWillContact).toBe('我们将审核您的请求并尽快与您联系');
  });
});
