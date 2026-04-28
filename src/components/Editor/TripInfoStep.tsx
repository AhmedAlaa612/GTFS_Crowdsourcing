'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AGENCY_VEHICLE_MAP } from '@/lib/database.types';

export type InputMethod = 'stops' | 'file';

const VEHICLE_OPTIONS = Object.entries(AGENCY_VEHICLE_MAP).map(([id, v]) => ({
  agency_id: id,
  label: `${v.en} — ${v.ar}`,
  short_name: v.en,
  short_name_ar: v.ar,
}));

export interface TripFormData {
  routeLongName: string;
  routeLongNameAr: string;
  agencyId: string;
  tripHeadsign: string;
  tripHeadsignAr: string;
  directionId: number;
  mainStreets: string;
  mainStreetsAr: string;
  fareAmount: string;
  comment: string;
  inputMethod: InputMethod;
}

interface TripInfoStepProps {
  form: TripFormData;
  onChange: (updates: Partial<TripFormData>) => void;
  onNext: () => void;
}

export function TripInfoStep({ form, onChange, onNext }: TripInfoStepProps) {
  const selectedVehicle = VEHICLE_OPTIONS.find(v => v.agency_id === form.agencyId);

  const canProceed = form.routeLongName.trim() && form.agencyId && form.tripHeadsign.trim();

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Define the Route</h2>
        <p className="text-muted-foreground mt-1">
          Provide route and trip details in English and Arabic
        </p>
      </div>

      <div className="space-y-4">
        {/* Route Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="route-name">Route Name (English) *</Label>
            <Input
              id="route-name"
              placeholder='e.g. "Asafra - Sidi Bishr"'
              value={form.routeLongName}
              onChange={(e) => onChange({ routeLongName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="route-name-ar">اسم الخط (عربي)</Label>
            <Input
              id="route-name-ar"
              dir="rtl"
              placeholder='مثال: "العصافرة - سيدي بشر"'
              value={form.routeLongNameAr}
              onChange={(e) => onChange({ routeLongNameAr: e.target.value })}
            />
          </div>
        </div>

        {/* Vehicle Type */}
        <div className="space-y-1.5">
          <Label>Vehicle Type *</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {VEHICLE_OPTIONS.map((v) => (
              <button
                key={v.agency_id}
                type="button"
                onClick={() => onChange({ agencyId: v.agency_id })}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs font-medium transition-all ${form.agencyId === v.agency_id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                  }`}
              >
                <span className="text-lg">
                  {v.agency_id === 'Bus' ? 'B' : v.agency_id === 'Minibus' ? 'Mn' : 'Mb'}
                </span>
                <span>{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Trip Headsign */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="headsign">Trip Headsign (English) *</Label>
            <Input
              id="headsign"
              placeholder='e.g. "Asafra" (destination)'
              value={form.tripHeadsign}
              onChange={(e) => onChange({ tripHeadsign: e.target.value })}
            />
            <p className="text-[10px] text-muted-foreground">
              Where this direction of the trip goes to
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="headsign-ar">الوجهه (عربي)</Label>
            <Input
              id="headsign-ar"
              dir="rtl"
              placeholder='مثال: "العصافرة"'
              value={form.tripHeadsignAr}
              onChange={(e) => onChange({ tripHeadsignAr: e.target.value })}
            />
          </div>
        </div>

        {/* Direction */}
        <div className="space-y-1.5">
          <Label>Direction</Label>
          <div className="flex gap-2">
            {[
              { val: 0, label: 'Outbound (ذهاب)' },
              { val: 1, label: 'Inbound (عودة)' },
            ].map(d => (
              <button
                key={d.val}
                type="button"
                onClick={() => onChange({ directionId: d.val })}
                className={`flex-1 p-2.5 rounded-lg border-2 text-sm font-medium transition-all ${form.directionId === d.val
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>


        {/* Fare */}
        <div className="space-y-1.5">
          <Label htmlFor="fare">Fare Amount - الاجرة</Label>
          <div className="flex gap-2">
            <Input
              id="fare"
              type="number"
              step="0.5"
              min="0"
              placeholder="e.g. 5"
              value={form.fareAmount}
              onChange={(e) => onChange({ fareAmount: e.target.value })}
              className="flex-1"
            />
            <div className="flex items-center px-3 rounded-md border border-input bg-muted text-sm text-muted-foreground">
              EGP
            </div>
          </div>
        </div>

        {/* Input method */}
        <div className="space-y-2">
          <Label>How will you define the route?</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChange({ inputMethod: 'stops' })}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all ${form.inputMethod === 'stops'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                }`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Pick stops on map</span>
            </button>

            <button
              type="button"
              onClick={() => onChange({ inputMethod: 'file' })}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all ${form.inputMethod === 'file'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                }`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span>Upload GPX / GeoJSON</span>
            </button>
          </div>
        </div>

        {/* Comment */}
        <div className="space-y-1.5">
          <Label htmlFor="comment">Comment (optional)</Label>
          <Textarea
            id="comment"
            placeholder="Any notes for reviewers — e.g. frequency, operating hours…"
            value={form.comment}
            onChange={(e) => onChange({ comment: e.target.value })}
            rows={3}
            className="resize-none text-sm"
          />
        </div>
      </div>

      <Button
        size="lg"
        className="w-full"
        onClick={onNext}
        disabled={!canProceed}
      >
        {form.inputMethod === 'file' ? 'Next — Upload File' : 'Next — Pick Stops'}
      </Button>
    </div>
  );
}