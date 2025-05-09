import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import en from '@/translations/en';
import cs from '@/translations/cs';
import de from '@/translations/de';
import es from '@/translations/es';
import fr from '@/translations/fr';
import zh from '@/translations/zh';

describe('Common Translation Keys', () => {
  it('should have all required common translation keys in English', () => {
    expect(en.common.appName).toBe('Spheroid Segmentation');
    expect(en.common.loading).toBe('Loading...');
    expect(en.common.error).toBe('Error');
    expect(en.common.success).toBe('Success');
    expect(en.common.save).toBe('Save');
    expect(en.common.cancel).toBe('Cancel');
    expect(en.common.delete).toBe('Delete');
    expect(en.common.edit).toBe('Edit');
    expect(en.common.create).toBe('Create');
    expect(en.common.search).toBe('Search');
    expect(en.common.dashboard).toBe('Dashboard');
    expect(en.common.profile).toBe('Profile');
    expect(en.common.settings).toBe('Settings');
    expect(en.common.signOut).toBe('Sign Out');
    expect(en.common.language).toBe('Language');
    expect(en.common.notSpecified).toBe('Not specified');
  });

  it('should have all required common translation keys in Czech', () => {
    expect(cs.common.appName).toBe('Segmentace Sféroidů');
    expect(cs.common.loading).toBe('Načítání...');
    expect(cs.common.error).toBe('Chyba');
    expect(cs.common.success).toBe('Úspěch');
    expect(cs.common.save).toBe('Uložit');
    expect(cs.common.cancel).toBe('Zrušit');
    expect(cs.common.delete).toBe('Smazat');
    expect(cs.common.edit).toBe('Upravit');
    expect(cs.common.create).toBe('Vytvořit');
    expect(cs.common.search).toBe('Hledat');
    expect(cs.common.dashboard).toBe('Přehled');
    expect(cs.common.profile).toBe('Profil');
    expect(cs.common.settings).toBe('Nastavení');
    expect(cs.common.signOut).toBe('Odhlásit se');
    expect(cs.common.language).toBe('Jazyk');
    expect(cs.common.notSpecified).toBe('Neuvedeno');
  });

  it('should have all required common translation keys in German', () => {
    expect(de.common.appName).toBe('Spheroid-Segmentierung');
    expect(de.common.loading).toBe('Wird geladen...');
    expect(de.common.error).toBe('Fehler');
    expect(de.common.success).toBe('Erfolg');
    expect(de.common.save).toBe('Speichern');
    expect(de.common.cancel).toBe('Abbrechen');
    expect(de.common.delete).toBe('Löschen');
    expect(de.common.edit).toBe('Bearbeiten');
    expect(de.common.create).toBe('Erstellen');
    expect(de.common.search).toBe('Suchen');
    expect(de.common.dashboard).toBe('Dashboard');
    expect(de.common.profile).toBe('Profil');
    expect(de.common.settings).toBe('Einstellungen');
    expect(de.common.signOut).toBe('Abmelden');
    expect(de.common.language).toBe('Sprache');
  });

  it('should have all required common translation keys in Spanish', () => {
    expect(es.common.appName).toBe('Segmentación de Esferoides');
    expect(es.common.loading).toBe('Cargando...');
    expect(es.common.error).toBe('Error');
    expect(es.common.success).toBe('Éxito');
    expect(es.common.save).toBe('Guardar');
    expect(es.common.cancel).toBe('Cancelar');
    expect(es.common.delete).toBe('Eliminar');
    expect(es.common.edit).toBe('Editar');
    expect(es.common.create).toBe('Crear');
    expect(es.common.search).toBe('Buscar');
    expect(es.common.dashboard).toBe('Panel de control');
    expect(es.common.profile).toBe('Perfil');
    expect(es.common.settings).toBe('Configuración');
    expect(es.common.signOut).toBe('Cerrar sesión');
    expect(es.common.language).toBe('Idioma');
  });

  it('should have all required common translation keys in French', () => {
    expect(fr.common.appName).toBe('Segmentation de Sphéroïdes');
    expect(fr.common.loading).toBe('Chargement...');
    expect(fr.common.error).toBe('Erreur');
    expect(fr.common.success).toBe('Succès');
    expect(fr.common.save).toBe('Enregistrer');
    expect(fr.common.cancel).toBe('Annuler');
    expect(fr.common.delete).toBe('Supprimer');
    expect(fr.common.edit).toBe('Modifier');
    expect(fr.common.create).toBe('Créer');
    expect(fr.common.search).toBe('Rechercher');
    expect(fr.common.dashboard).toBe('Tableau de bord');
    expect(fr.common.profile).toBe('Profil');
    expect(fr.common.settings).toBe('Paramètres');
    expect(fr.common.signOut).toBe('Se déconnecter');
    expect(fr.common.language).toBe('Langue');
  });

  it('should have all required common translation keys in Chinese', () => {
    expect(zh.common.appName).toBe('类器官分割平台');
    expect(zh.common.loading).toBe('加载中...');
    expect(zh.common.editor.error).toBe('错误');
    expect(zh.common.editor.success).toBe('成功');
    expect(zh.common.save).toBe('保存');
    expect(zh.common.cancel).toBe('取消');
    expect(zh.common.delete).toBe('删除');
    expect(zh.common.editor.edit).toBe('编辑');
    expect(zh.common.editor.create).toBe('创建');
    expect(zh.common.dashboard).toBe('仪表板');
    expect(zh.common.profile).toBe('个人资料');
    expect(zh.common.settings).toBe('设置');
    expect(zh.common.signOut).toBe('退出登录');
    expect(zh.common.language).toBe('语言');
  });
});
