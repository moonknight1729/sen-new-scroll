import { useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  ImageOverlay,
  FeatureGroup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { EditControl } from "react-leaflet-draw";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import evalscripts from "./assets/evalscripts.json";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Define types for the props and data structures
interface ImageLayerProps {
  imageUrl: string | null;
  aoiBounds: [[number, number], [number, number]] | null;
}

interface GeoJSON {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
}

interface Datacollection {
  script: string;
  name: string;
  image: string;
}

interface SatelliteData {
  [key: string]: Datacollection[];
}
const myevscript: SatelliteData = evalscripts;

// let selector:(v:string)=>void;

// ImageLayer component with props type definition
function ImageLayer({ imageUrl, aoiBounds }: ImageLayerProps) {
  const map = useMap();

  if (imageUrl && aoiBounds) {
    map.fitBounds(aoiBounds);
  }

  return imageUrl && aoiBounds ? (
    <ImageOverlay url={imageUrl} bounds={aoiBounds} />
  ) : null;
}

export default function App() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [aoiBounds, setAoiBounds] = useState<
    [[number, number], [number, number]] | null
  >(null);
  const [startDate, setStartDate] = useState<Date>(new Date("2023-10-01"));
  const [endDate, setEndDate] = useState<Date>(new Date("2023-10-31"));
  const [geojson, setGeojson] = useState<GeoJSON | null>(null);
  const [selectedSatellite, setSelectedSatellite] =
    useState<string>("sentinel");
  const [selectedEvalscript, setSelectedEvalscript] = useState<number>(0);
  const featureGroupRef = useRef<L.FeatureGroup | null>(null);

  async function getToken() {
    const url = "https://backend.fitclimate.com/auth/get-token";
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
      }

      const json = await response.json();
      const token = json.access_token;
      console.log(token);
      return token;
    } catch (error: any) {
      console.error(error.message);
    }
  }

  const getImage = async () => {
    if (!geojson) {
      console.error("No AOI defined. Please draw an area on the map.");
      return;
    }

    try {
      const token = await getToken();
      const response = await fetch(
        "https://services.sentinel-hub.com/api/v1/process",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer" + " " + token,
          },
          body: JSON.stringify({
            input: {
              bounds: {
                geometry: geojson.geometry,
                properties: {
                  crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
                },
              },
              data: [
                {
                  type: "sentinel-2-l2a",
                  dataFilter: {
                    timeRange: {
                      from: startDate.toISOString(),
                      to: endDate.toISOString(),
                    },
                  },
                },
              ],
              output: {
                width: 512,
                height: 512,
              },
            },
            evalscript:
              myevscript[selectedSatellite][selectedEvalscript].script,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Error fetching image: " + response.statusText);
      }

      const imageBlob = await response.blob();
      const imageUrl = URL.createObjectURL(imageBlob);
      setImageUrl(imageUrl);
    } catch (error) {
      console.error("Error fetching image:", error);
    }
  };

  const handleDrawCreate = (e: any) => {
    const layer = e.layer;
    const shape = layer.toGeoJSON();
    const { coordinates } = shape.geometry;

    const [[minLng, minLat], [maxLng, maxLat]] = coordinates[0].reduce(
      (
        [min, max]: [[number, number], [number, number]],
        [lng, lat]: [number, number]
      ) => [
        [Math.min(min[0], lng), Math.min(min[1], lat)],
        [Math.max(max[0], lng), Math.max(max[1], lat)],
      ],
      [
        [Infinity, Infinity],
        [-Infinity, -Infinity],
      ]
    );

    setAoiBounds([
      [minLat, minLng],
      [maxLat, maxLng],
    ]);
    setGeojson(shape);
  };

  const handleStartDateChange = (date: Date | null) => {
    if (date) setStartDate(date);
  };

  const handleEndDateChange = (date: Date | null) => {
    if (date) setEndDate(date);
  };

  return (
    <>
      <div className="my-[20px] flex flex-row justify-around ">
        <div>
          <label>Start Date: </label>
          <DatePicker
            selected={startDate}
            onChange={handleStartDateChange}
            dateFormat="yyyy-MM-dd"
          />
        </div>
        <div>
          <label>End Date: </label>
          <DatePicker
            selected={endDate}
            onChange={handleEndDateChange}
            dateFormat="yyyy-MM-dd"
          />
        </div>
      </div>
      <div className="flex flex-row  justify-around">
        <Card className="w-[450px]">
          <CardHeader>
            <CardTitle>Dataset Collection</CardTitle>
            <CardDescription>
              Fetch data from your desired collection.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form>
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="framework">Satellite</Label>

                  <Select
                    onValueChange={(value) =>
                      setSelectedSatellite(value.toLowerCase())
                    }
                  >
                    <SelectTrigger id="framework">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="Sentinel">Sentinel-L2A</SelectItem>
                      <SelectItem value="Landsat">Landsat-8</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <ScrollArea className="h-72 w-full rounded-md border">
                  <div className="p-4">
                    <h4 className="mb-4 text-sm font-medium leading-none">
                      Visualise
                    </h4>
                    {myevscript[selectedSatellite].map(
                      (data: Datacollection, index: number) => (
                        <div key={index}>
                          <Toggle >
                          <button
                            onClick={(e) => {
                              setSelectedEvalscript(index);
                              e.preventDefault();
                            }}
                            className="flex flex-row gap-[28px] items-center"
                          >
                            <img
                              className="border-[3px] border-black size-8 rounded-[100px]"
                              src={data.image}
                              alt={`${data.name} thumbnail`}
                            />
                            {data.name}
                          </button>
                          </Toggle>
                          

                          <Separator className="my-2" />
                        </div>
                      )
                    )}
                  </div>
                </ScrollArea>
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              onClick={() => {
                getImage();
              }}
            >
              Fetch Image
            </Button>
          </CardFooter>
        </Card>
        <MapContainer
          center={[46.07136085454608, 14.190902709960938]}
          zoom={10}
          style={{ height: "600px", width: "800px", marginTop: "20px" }}
          className="  rounded-[8px]"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ImageLayer imageUrl={imageUrl} aoiBounds={aoiBounds} />
          <FeatureGroup ref={featureGroupRef}>
            <EditControl
              position="topright"
              onCreated={handleDrawCreate}
              draw={{
                rectangle: true,
                polygon: true,
                polyline: false,
                circle: false,
                circlemarker: false,
                marker: false,
              }}
            />
          </FeatureGroup>
        </MapContainer>
      </div>
    </>
  );
}
