import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'agro_theme';

  /** true = dark mode (default), false = light mode */
  readonly isDark = signal(true);

  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    const useDark = saved ? saved === 'dark' : true;
    this.isDark.set(useDark);
    this.applyTheme(useDark);
  }

  toggle(): void {
    const newValue = !this.isDark();
    this.isDark.set(newValue);
    localStorage.setItem(this.STORAGE_KEY, newValue ? 'dark' : 'light');
    this.applyTheme(newValue);
  }

  private applyTheme(isDark: boolean): void {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove('light-theme');
      root.classList.add('dark-theme');
    } else {
      root.classList.remove('dark-theme');
      root.classList.add('light-theme');
    }
  }
}
