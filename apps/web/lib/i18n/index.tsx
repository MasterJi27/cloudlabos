"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type Locale = "en" | "hi" | "es" | "zh" | "ja";

const messages: Record<Locale, Record<string, string>> = {
  en: {
    "app.name": "CloudLabOS",
    "app.tagline": "Enterprise AI Workflow OS",
    "nav.dashboard": "Dashboard",
    "nav.agents": "Agents",
    "nav.workflows": "Workflows",
    "nav.runs": "Runs",
    "nav.memory": "Memory",
    "nav.approvals": "Approvals",
    "nav.terminal": "Terminal",
    "nav.browser": "Browser",
    "nav.webhooks": "Webhooks",
    "nav.logs": "Logs",
    "nav.plugins": "Plugins",
    "nav.analytics": "Analytics",
    "nav.billing": "Billing",
    "nav.invitations": "Invitations",
    "nav.settings": "Settings",
    "auth.login": "Sign in",
    "auth.signup": "Create an account",
    "auth.email": "Email Address",
    "auth.password": "Password",
    "auth.name": "Name",
    "auth.forgot": "Forgot?",
    "auth.or": "or login with",
    "auth.no_account": "Don't have an account? Sign up",
    "auth.has_account": "Already have an account? Sign in",
    "workspace.search": "Search...",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.create": "Create",
    "common.edit": "Edit",
    "common.loading": "Loading...",
    "common.no_data": "No data",
  },
  hi: {
    "app.name": "क्लाउडलैबओएस",
    "app.tagline": "एंटरप्राइज़ AI वर्कफ़्लो OS",
    "nav.dashboard": "डैशबोर्ड",
    "nav.agents": "एजेंट",
    "nav.workflows": "वर्कफ़्लो",
    "nav.runs": "रन",
    "nav.memory": "मेमोरी",
    "nav.approvals": "अनुमोदन",
    "nav.terminal": "टर्मिनल",
    "nav.browser": "ब्राउज़र",
    "nav.webhooks": "वेबहुक",
    "nav.logs": "लॉग",
    "nav.plugins": "प्लगइन",
    "nav.analytics": "एनालिटिक्स",
    "nav.billing": "बिलिंग",
    "nav.invitations": "आमंत्रण",
    "nav.settings": "सेटिंग्स",
    "auth.login": "साइन इन",
    "auth.signup": "खाता बनाएं",
    "auth.email": "ईमेल पता",
    "auth.password": "पासवर्ड",
    "auth.name": "नाम",
    "auth.forgot": "भूल गए?",
    "auth.or": "या इससे लॉगिन करें",
    "auth.no_account": "खाता नहीं है? साइन अप करें",
    "auth.has_account": "पहले से खाता है? साइन इन करें",
    "workspace.search": "खोजें...",
    "common.save": "सहेजें",
    "common.cancel": "रद्द करें",
    "common.delete": "हटाएं",
    "common.create": "बनाएं",
    "common.edit": "संपादित करें",
    "common.loading": "लोड हो रहा है...",
    "common.no_data": "कोई डेटा नहीं",
  },
  es: {
    "app.name": "CloudLabOS",
    "app.tagline": "SO de flujo de trabajo AI empresarial",
    "nav.dashboard": "Panel",
    "auth.login": "Iniciar sesión",
    "auth.email": "Correo electrónico",
    "auth.password": "Contraseña",
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.loading": "Cargando...",
  },
  zh: {
    "app.name": "CloudLabOS",
    "app.tagline": "企业AI工作流操作系统",
    "nav.dashboard": "仪表板",
    "auth.login": "登录",
    "auth.email": "电子邮件",
    "auth.password": "密码",
    "common.save": "保存",
    "common.cancel": "取消",
    "common.loading": "加载中...",
  },
  ja: {
    "app.name": "CloudLabOS",
    "app.tagline": "エンタープライズAIワークフローOS",
    "nav.dashboard": "ダッシュボード",
    "auth.login": "サインイン",
    "auth.email": "メールアドレス",
    "auth.password": "パスワード",
    "common.save": "保存",
    "common.cancel": "キャンセル",
    "common.loading": "読み込み中...",
  },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key: string) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  const t = useCallback(
    (key: string) => messages[locale]?.[key] || messages.en[key] || key,
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
