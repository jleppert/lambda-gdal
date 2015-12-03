#!/usr/bin/env bash
# this script generates and tiles contours from a DSM
# usage: contours.sh <dsm.tif> <interval> <color_relief> <color_slope> <mapnik_style> <zoom>
# example: contours.sh dsm.tif 1.0 default.xml 15-22
# outputs: the directory that contains the tileset
dsm=$1
interval=$2
color_relief=$3
color_slope=$4
style=$5
zoom=$6
outputDir=/tmp/$(cat /dev/urandom | tr -cd 'a-f0-9' | head -c 32)
outputHillShadeTif=$(cat /dev/urandom | tr -cd 'a-f0-9' | head -c 32).tif
outputColorReliefTif=$(cat /dev/urandom | tr -cd 'a-f0-9' | head -c 32).tif
outputSlopeTif=$(cat /dev/urandom | tr -cd 'a-f0-9' | head -c 32).tif
outputSlopeShadeTif=$(cat /dev/urandom | tr -cd 'a-f0-9' | head -c 32).tif
outputPng=$(cat /dev/urandom | tr -cd 'a-f0-9' | head -c 32).png

# replace these variables with the locations of these gdal utilities
gdalbuildvrt=$(which gdalbuildvrt)
gdal2tiles=$(which gdal2tiles.py)
gdalsrsinfo=$(which gdalsrsinfo)
gdalinfo=$(which gdalinfo)
gdal_translate=$(which gdal_translate)
gdal_contour=$(which gdal_contour)
gdaldem=$(which gdaldem)
nik2img=$(which nik2img.py)

function gdal_extent() {
    EXTENT=$($gdalinfo $1 |\
        grep "Upper Left\|Lower Right" |\
        sed "s/Upper Left  //g;s/Lower Right //g;s/).*//g" |\
        tr "\n" " " |\
        sed 's/ *$//g' |\
        tr -d "[(,]")
    echo -n "$EXTENT"
}

function nodata_value() {
  NODATA=$($gdalinfo $1 |\
    grep "NoData Value=" |\
    sed "s/NoData Value=//g" |\
    xargs)
  echo -n "$NODATA"  
}

function get_range() {
  RANGE=$($gdalinfo -mm $1 |\
    grep "Computed Min\/Max=" |\
    sed "s/Computed Min\/Max=//g" |\
    xargs)

  echo -n "$RANGE"
}

function min_value() {
  RANGE=$(get_range $1)
  aRange=(${RANGE//,/ })
  echo -n "${aRange[0]}"
}

function max_value() {
  RANGE=$(get_range $1)
  aRange=(${RANGE//,/ })
  echo -n "${aRange[1]}"
}

function dimensions_value() {
  DIMENSIONS=$($gdalinfo $1 |\
    grep "Size is" |\
    sed "s/Size is//g" |\
    sed "s/,//g" |\
    xargs)
  echo -n "$DIMENSIONS"
}

base_style=$(cat $style)
base_color_relief=$(cat $color_relief)
base_color_slope=$(cat $color_slope)
srs=$(gdalsrsinfo -o wkt $dsm)
proj4=$(gdalsrsinfo -o proj4 $dsm | tr "'" " " | xargs)
style=${base_style/\$proj4/$proj4} 
outputShp="$outputDir/contours.shp"
style=${style/\$shapefile/$outputShp}

destColorReliefTif="$outputDir/$outputColorReliefTif"
destSlopeShadeTif="$outputDir/$outputSlopeShadeTif"
destHillShadeTif="$outputDir/$outputHillShadeTif"

style=${style/\$destColorReliefTif/$destColorReliefTif}
style=${style/\$destSlopeShadeTif/$destSlopeShadeTif}
style=${style/\$destHillShadeTif/$destHillShadeTif}

destStyle="$outputDir/style.xml"
destColorRelief="$outputDir/color_relief.txt"
destColorSlope="$outputDir/color_slope.txt"
max_value=$(max_value $dsm)
min_value=$(min_value $dsm)
range=$(echo "$max_value - $min_value" | bc)
colorSteps=$(wc -l < "$color_relief")
colorInterval=$(echo "scale=2; $range / $colorSteps" | bc)

currentStep=$min_value
while IFS='' read -r line || [[ -n "$line" ]]; do
  line=${line/\{\}/$currentStep}
  colors="$colors\n$line"
  currentStep=$(echo "$currentStep + $colorInterval" | bc)
done < "$color_relief"

extent=$(gdal_extent $dsm)
nodata=$(nodata_value $dsm)
dimensions=$(dimensions_value $dsm)

# these commands will be run
contour="$gdal_contour -a height $dsm -i $interval $outputDir/contours.shp"
hillshadeTif="$gdaldem hillshade $dsm $destHillShadeTif"
reliefTif="$gdaldem color-relief $dsm $destColorRelief $destColorReliefTif"
slopeTif="$gdaldem slope $dsm $outputDir/$outputSlopeTif"
slopeShadeTif="$gdaldem color-relief $outputDir/$outputSlopeTif $destColorSlope $destSlopeShadeTif"
translate="$gdal_translate -of VRT -a_ullr $extent -a_srs $srs $outputDir/$outputPng $outputDir/contours.vrt"

map="$nik2img $destStyle $outputDir/$outputPng -d $dimensions -e $extent"
tile="$gdal2tiles -p mercator -z $zoom $outputDir/contours.vrt"

mkdir -p $outputDir
echo "$style" >> "$destStyle"
echo -e "$colors" >> "$destColorRelief"
sed -i -e "1d" $destColorRelief
echo -e "$base_color_slope" >> "$destColorSlope"
echo $contour
echo $hillshadeTif
echo $reliefTif
echo $slopeTif
echo $slopeShadeTif
echo $map
echo $translate
cd $outputDir
echo $tile
echo -n "Contour tiles generated to: " $outputDir
