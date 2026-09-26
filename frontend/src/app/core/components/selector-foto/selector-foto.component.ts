import { Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { redimensionarImagen } from '../../utils/imagen.util';

const DIMENSION_MAXIMA = 300;

/**
 * Botón de avatar (foto o iniciales) que al hacer clic abre un selector con
 * 3 formas de conseguir una imagen: cámara, archivo del equipo, o pegar
 * (Ctrl+V). Solo entrega el resultado vía (fotoCambiada) -- no llama a
 * ningún servicio ni decide cuándo se persiste; eso lo resuelve quien lo
 * use (guardar de inmediato, o solo al enviar un formulario más grande).
 */
@Component({
  selector: 'app-selector-foto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './selector-foto.component.html',
  styleUrls: ['./selector-foto.component.scss']
})
export class SelectorFotoComponent implements OnDestroy {
  @Input() foto: string | null | undefined = null;
  @Input() nombre = '';
  @Input() titulo = 'Cambiar foto';
  @Input() soloLectura = false;
  @Input() ocultarDisparador = false;
  @Input() cuadrado = false;
  @Input() tamano = 100;
  @Output() fotoCambiada = new EventEmitter<string>();
  @Output() fotoEliminada = new EventEmitter<void>();

  mostrarSelector = signal(false);
  capturandoCamara = signal(false);
  hayVariasCamaras = signal(false);
  private camaraStream: MediaStream | null = null;
  private facingMode: 'user' | 'environment' = 'user';

  @ViewChild('videoFoto') videoFotoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('fileInputFoto') fileInputFotoRef?: ElementRef<HTMLInputElement>;

  iniciales(): string {
    return (this.nombre || '')
      .split(' ')
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase())
      .join('');
  }

  abrirSelector(): void {
    if (this.soloLectura) return;
    this.mostrarSelector.set(true);
    this.capturandoCamara.set(false);
  }

  cerrarSelector(): void {
    this.detenerCamara();
    this.mostrarSelector.set(false);
  }

  elegirArchivo(): void {
    this.fileInputFotoRef?.nativeElement.click();
  }

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      alert('Selecciona un archivo de imagen válido.');
      return;
    }
    redimensionarImagen(archivo, DIMENSION_MAXIMA).then(base64 => this.emitirFoto(base64));
  }

  async iniciarCamara(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facingMode } });
      this.camaraStream = stream;
      this.capturandoCamara.set(true);
      setTimeout(() => {
        if (this.videoFotoRef) this.videoFotoRef.nativeElement.srcObject = stream;
      });
      navigator.mediaDevices.enumerateDevices()
        .then(dispositivos => this.hayVariasCamaras.set(dispositivos.filter(d => d.kind === 'videoinput').length > 1))
        .catch(() => this.hayVariasCamaras.set(false));
    } catch {
      alert('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
    }
  }

  async cambiarCamara(): Promise<void> {
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    this.camaraStream?.getTracks().forEach(t => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facingMode } });
      this.camaraStream = stream;
      if (this.videoFotoRef) this.videoFotoRef.nativeElement.srcObject = stream;
    } catch {
      alert('No se pudo cambiar de cámara.');
    }
  }

  capturarFoto(): void {
    const video = this.videoFotoRef?.nativeElement;
    if (!video) return;

    // A diferencia del archivo/pegado (que pasan por redimensionarImagen),
    // aquí se limita el tamaño directamente al capturar el frame, para no
    // guardar la resolución cruda de la cámara en la base de datos.
    const escala = Math.min(1, DIMENSION_MAXIMA / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * escala);
    canvas.height = Math.round(video.videoHeight * escala);
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.85);

    this.detenerCamara();
    this.emitirFoto(base64);
  }

  detenerCamara(): void {
    this.camaraStream?.getTracks().forEach(t => t.stop());
    this.camaraStream = null;
    this.capturandoCamara.set(false);
    this.facingMode = 'user';
  }

  onPasteFoto(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const archivo = items[i].getAsFile();
        if (archivo) redimensionarImagen(archivo, DIMENSION_MAXIMA).then(base64 => this.emitirFoto(base64));
        return;
      }
    }
    alert('No se encontró ninguna imagen en el portapapeles.');
  }

  eliminarFoto(): void {
    if (!confirm('¿Eliminar esta foto?')) return;
    this.fotoEliminada.emit();
    this.cerrarSelector();
  }

  ngOnDestroy(): void {
    this.detenerCamara();
  }

  private emitirFoto(base64: string): void {
    this.fotoCambiada.emit(base64);
    this.cerrarSelector();
  }
}
