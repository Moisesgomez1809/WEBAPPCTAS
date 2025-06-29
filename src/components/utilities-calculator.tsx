
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wallet } from "lucide-react";

interface UtilitiesCalculatorProps {
  providerCost: number | string;
  clientCost: number | string;
  profit: number;
  onProviderCostChange: (value: string) => void;
  onClientCostChange: (value: string) => void;
}

export default function UtilitiesCalculator({
  providerCost,
  clientCost,
  profit,
  onProviderCostChange,
  onClientCostChange,
}: UtilitiesCalculatorProps) {

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value);
  };

  return (
    <Card className="mt-6 border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Wallet className="mr-2 h-5 w-5" />
          Utilidad del Trámite
        </CardTitle>
        <CardDescription>
          La ganancia se guardará al descargar el archivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="space-y-2">
          <Label htmlFor="providerCost">Costo Proveedor</Label>
          <Input
            id="providerCost"
            type="number"
            placeholder="e.g., 50"
            value={providerCost}
            onChange={(e) => onProviderCostChange(e.target.value)}
            min="0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientCost">Costo Cliente</Label>
          <Input
            id="clientCost"
            type="number"
            placeholder="e.g., 150"
            value={clientCost}
            onChange={(e) => onClientCostChange(e.target.value)}
            min="0"
          />
        </div>
        <div className="space-y-2">
            <Label>Ganancia</Label>
            <div className="flex h-10 w-full items-center justify-center rounded-md border border-input bg-secondary px-3 py-2 text-lg font-bold text-green-600">
                {formatCurrency(profit)}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
