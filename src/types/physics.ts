export type Language = 'bn' | 'en';

export type ModuleId = 'module1' | 'module2' | 'module3' | 'module4' | 'module5';

export interface WireMaterial {
  id: string;
  nameBn: string;
  nameEn: string;
  youngModulus: number; // in Pa (e.g. 200e9)
  yieldStress: number; // in Pa (e.g. 250e6)
  breakingStress: number; // in Pa (e.g. 400e6)
  poissonRatio: number; // e.g. 0.30
  density: number; // kg/m^3
  color: string;
  specular: string;
}

export interface FluidType {
  id: string;
  nameBn: string;
  nameEn: string;
  density: number; // kg/m3 (e.g. 1000 for water)
  color: string;
  viscosity: string;
}

export interface SubmergedSphereMaterial {
  id: string;
  nameBn: string;
  nameEn: string;
  bulkModulus: number; // in Pa (e.g. 1.2e9)
  crushPressure: number; // in Pa (collapse depth threshold)
  burstVacuum: number; // in Pa (expansion burst threshold)
  initialRadius: number; // in meters (e.g. 0.15)
  color: string;
  surfacePattern: string;
}

export interface ShearMaterial {
  id: string;
  nameBn: string;
  nameEn: string;
  shearModulus: number; // in Pa (e.g. 80e9)
  ultimateShearStress: number; // in Pa
  color: string;
}

export interface NexusMaterial {
  id: string;
  nameBn: string;
  nameEn: string;
  Y: number; // GPa
  K: number; // GPa
  eta: number; // GPa
  poisson: number;
  descriptionBn: string;
  descriptionEn: string;
}

export interface StressStrainMaterial {
  id: string;
  nameBn: string;
  nameEn: string;
  categoryBn: string;
  categoryEn: string;
  youngModulus: number; // GPa
  proportionalStrain: number;
  proportionalStress: number; // MPa
  yieldStrain: number;
  yieldStress: number; // MPa
  ultimateStrain: number;
  ultimateStress: number; // MPa
  fractureStrain: number;
  fractureStress: number; // MPa
  curveColor: string;
  descriptionBn: string;
  descriptionEn: string;
  isBrittle?: boolean;
  isElastomer?: boolean;
  isHighPlastic?: boolean;
}
