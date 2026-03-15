"use client";

import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend
);

type ChartRecord = {
  id: string;
  date: string;
  ageDays: number;
  feedKg: number;
  waterL: number;
  avgWeightG: number | null;
  weightPercent: number | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  humidityMinPct: number | null;
  humidityMaxPct: number | null;
  co2MinPpm: number | null;
  co2MaxPpm: number | null;
  dailyMortalityPct: number;
  weightTargetG: number | null;
  feedTargetG: number | null;
  waterTargetMl: number | null;
  temperatureTargetC: number | null;
  humidityTargetPct: number | null;
  co2TargetPpm: number | null;
};

export default function HouseChartsPage({ params }: any) {
  const { houseId } = params;

  const [houseName, setHouseName] = useState<string>("");
  const [cropLabel, setCropLabel] = useState<string>("");
  const [data, setData] = useState<ChartRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/houses/${houseId}/charts`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to load data.");
        }

        setHouseName(json.house?.name || "House");
        setCropLabel(json.crop?.cropNumber ? `Crop ${json.crop.cropNumber}` : "");
        setData(json.chartData || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [houseId]);

  if (loading) return <div style={{ padding: 30 }}>Loading charts...</div>;
  if (error) return <div style={{ padding: 30 }}>Error: {error}</div>;

  const labels = data.map((d) =>
    `${new Date(d.date).toLocaleDateString()} (D${d.ageDays})`
  );

  function buildSingleLine(label: string, values: (number | null)[]) {
    return {
      labels,
      datasets: [
        {
          label,
          data: values,
        },
      ],
    };
  }

  function buildActualVsTargetChart(
    actualLabel: string,
    targetLabel: string,
    actualValues: (number | null)[],
    targetValues: (number | null)[]
  ) {
    return {
      labels,
      datasets: [
        {
          label: actualLabel,
          data: actualValues,
        },
        {
          label: targetLabel,
          data: targetValues,
        },
      ],
    };
  }

  function buildMinMaxAndTargetChart(
    minLabel: string,
    maxLabel: string,
    targetLabel: string,
    minValues: (number | null)[],
    maxValues: (number | null)[],
    targetValues: (number | null)[]
  ) {
    return {
      labels,
      datasets: [
        {
          label: minLabel,
          data: minValues,
        },
        {
          label: maxLabel,
          data: maxValues,
        },
        {
          label: targetLabel,
          data: targetValues,
        },
      ],
    };
  }

  return (
    <div style={{ padding: 30 }}>
      <h1>{houseName} – Performance Charts</h1>
      <div style={{ marginBottom: 24, opacity: 0.8 }}>{cropLabel}</div>

      <h2>Average Weight (g)</h2>
      <Line
        data={buildActualVsTargetChart(
          "Actual Weight (g)",
          "Target Weight (g)",
          data.map((d) => d.avgWeightG),
          data.map((d) => d.weightTargetG)
        )}
      />

      <h2 style={{ marginTop: 40 }}>Weight %</h2>
      <Line
        data={buildSingleLine(
          "Weight %",
          data.map((d) => d.weightPercent)
        )}
      />

      <h2 style={{ marginTop: 40 }}>Feed Consumption</h2>
      <Line
        data={buildActualVsTargetChart(
          "Actual Feed (kg)",
          "Target Feed (g)",
          data.map((d) => d.feedKg),
          data.map((d) => d.feedTargetG)
        )}
      />

      <h2 style={{ marginTop: 40 }}>Water Consumption</h2>
      <Line
        data={buildActualVsTargetChart(
          "Actual Water (L)",
          "Target Water (ml)",
          data.map((d) => d.waterL),
          data.map((d) => d.waterTargetMl)
        )}
      />

      <h2 style={{ marginTop: 40 }}>Temperature</h2>
      <Line
        data={buildMinMaxAndTargetChart(
          "Actual Temp Min",
          "Actual Temp Max",
          "Target Temp",
          data.map((d) => d.temperatureMinC),
          data.map((d) => d.temperatureMaxC),
          data.map((d) => d.temperatureTargetC)
        )}
      />

      <h2 style={{ marginTop: 40 }}>Humidity</h2>
      <Line
        data={buildMinMaxAndTargetChart(
          "Actual Humidity Min",
          "Actual Humidity Max",
          "Target Humidity",
          data.map((d) => d.humidityMinPct),
          data.map((d) => d.humidityMaxPct),
          data.map((d) => d.humidityTargetPct)
        )}
      />

      <h2 style={{ marginTop: 40 }}>CO₂</h2>
      <Line
        data={buildMinMaxAndTargetChart(
          "Actual CO2 Min",
          "Actual CO2 Max",
          "Target CO2",
          data.map((d) => d.co2MinPpm),
          data.map((d) => d.co2MaxPpm),
          data.map((d) => d.co2TargetPpm)
        )}
      />

      <h2 style={{ marginTop: 40 }}>Daily Mortality %</h2>
      <Line
        data={buildSingleLine(
          "Daily Mortality %",
          data.map((d) => d.dailyMortalityPct)
        )}
      />
    </div>
  );
}