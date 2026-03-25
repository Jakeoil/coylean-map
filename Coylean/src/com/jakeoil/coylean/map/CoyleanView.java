package com.jakeoil.coylean.map;

import android.content.Context;
//import android.util.AttributeSet;
import android.util.Log;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MotionEvent;
import android.view.View;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DrawFilter;
import android.graphics.Paint;

public class CoyleanView extends View
{
   private static final String TAG = "Coylean";
   private final Map map;
   private static final int DarkSeaGreen   = 0xFF000000 | 0x8FBC8F;
   private static final int BlanchedAlmond = 0xFF000000 | 0xFFEBCD;
   private static final int BlueViolet = 0xFF000000 | 0x8A2BE2;
   private static final int Cyan   = 0xFF000000 | 0x00FFFF;
   private static final int BurlyWood = 0xFF000000 | 0xDEB887;
   private static final int AntiqueWhite = 0xFF000000 | 0xFAEBD7;
   private static final int Coral     = 0xFF000000 | 0xFF7F50;
   private static final int Azure     = 0xFF000000 | 0xF0FFFF;
   private static final int DeepPink  = 0xFF000000 | 0xFF1493;
   private static final int LemonChiffon = 0xFF000000 | 0xFFFACD;
   private static final int Tomato    = 0xFF000000 | 0xFF6347;
   private static final int Firebrick = 0xFF000000 | 0xB22222;
   private static final int Silver    = 0xFF000000 | 0xC0C0C0;
   private static final int NavajoWhite = 0xFF000000 | 0xFFDEAD;
   private static final int Brown     = 0xFF000000 | 0xA52A2A;
   private static final int Fuchsia   = 0xFF000000 | 0xFF00FF;
   private static final int Turquoise = 0xFF000000 | 0x40E0D0;
   private static final int Magenta   = 0xFF000000 | 0xFF00FF;

      
   Paint mPaint = new Paint();
   private Bitmap mBitmap; // We'll try to draw it on the bitmap
   private Canvas mCanvas;
   // This will be a choice
   // This is Coylean stuff;
   int screen_width;
   int screen_height;
   private boolean[] downArrows;
   private boolean[] rightArrows;
   int numOfDowns;
   int numOfRights;
   int scale;
   int old_o;
   int x_place;
   int y_place;
   Canvas g;
   int maxPri = 12;
   int clicks = 0;
   int depth = 3;
   int x_width;
   int y_height;
   int[] colorList = {
      DarkSeaGreen,
      BlanchedAlmond,
      BlueViolet,
      Cyan,
      BurlyWood,
      AntiqueWhite,
      Coral,
      Azure,
      DeepPink,
      DarkSeaGreen,
      LemonChiffon,
      Tomato,
      Firebrick,
      Silver,
      NavajoWhite,
      Brown,
      Fuchsia,
      Turquoise,
      Magenta};
      
   public CoyleanView(Context context)
   {
      super(context);
      scale = 4;
      maxPri = 12;
      invalidate();
      clicks = 0;
      depth = 9;
      
      
      this.map=(Map)context;
      setFocusable(true);
      setFocusableInTouchMode(true);
   }
   @Override
   protected void onSizeChanged(int w, int h, int oldw, int oldh) {
      screen_width=2048;screen_height=2048;
      Log.d(TAG, "size change");

      Bitmap newBitmap = 
         Bitmap.createBitmap(screen_width,screen_height,Bitmap.Config.RGB_565);
      Canvas newCanvas = new Canvas();
      newCanvas.setBitmap(newBitmap);
      if (mBitmap != null) {
          newCanvas.drawBitmap(mBitmap, 0, 0, null);
      }
      mBitmap = newBitmap;
      mCanvas = newCanvas;
      draw_map(mCanvas);
      
      
      
      super.onSizeChanged(w, h, oldw, oldh);
      // compute the origin of the screen relative to the origin of
      // the bitmap
   }
   //---------------------------------------------------------------
   // Measures how "even" a number is
   private int Priority(int i) {
      for (int j = 0; j < maxPri; j++) {
         if (i % 2 != 0)
            return j;
         i = i / 2;
      }
      return (maxPri);
   }

   //---------------------------------------------------------------
   // Just finds the log base 2
   private int ComputeMaxPri(int ds, int rs) {
      if (ds < rs)
         ds = rs;
      for (int i = 0; i < 32; i++) {
         if (ds < 1)
            return i;
         ds = ds / 2;
      }
      return 32;
   }
   //---------------------------------------------------------------
   // Main Paint routine
   @Override protected void onDraw(Canvas canvas) 
   {
      
      canvas.translate(mAnchorX + mTouchCurrX - mTouchStartX,
                       mAnchorY + mTouchCurrY - mTouchStartY);
      canvas.scale(2, 2);
      if (mBitmap != null) {
         canvas.drawBitmap(mBitmap, 0, 0, null);
     }
   }
   private void draw_map(Canvas canvas)
   {
      g = canvas; // Expose to other methods
      g.drawColor(Color.WHITE);
      
      int t = 0;

      y_height = 0;
      x_width = 0;

      numOfDowns = screen_width / scale;
      Log.d(TAG,"numOfDowns = "+ numOfDowns);
      numOfRights = screen_height / scale;
      if (map.complexity==Map.COMPLEXITY_ELABORATE) {
         // divide it again
         numOfDowns /= 2;
         numOfRights /= 2;
      }
      downArrows = new boolean[numOfDowns];
      rightArrows = new boolean[numOfRights];
      maxPri = ComputeMaxPri(numOfDowns, numOfRights);
      for (int y = 0; y < numOfRights; y++)
         rightArrows[y] = false;
      for (int x = 0; x < numOfDowns; x++)
         downArrows[x] = false;
      downArrows[0] = true;
      y_place = 0;
      for (int y = 0; y < numOfRights; y++) 
      {
         x_place = 0;
         for (int x = 0; x < numOfDowns; x++) 
         {
            boolean down = downArrows[x];
            boolean right = rightArrows[y];

            int downPri = Priority(x);
            int rightPri = Priority(y);
            if (downPri >= rightPri) 
            {
               if (down)
                  right = !right;
            } 
            else if (right)
               down = !down;
            if (map.complexity==Map.COMPLEXITY_ELABORATE) 
            {
               RenderComplex(downArrows[x], downPri, rightArrows[y],
                     rightPri, down, right);
            } 
            else 
            {
               RenderSimple(downArrows[x], rightArrows[y]);
            }
            t++;
            // if (t > clicks) return;
            // Set up for next iteration
            downArrows[x] = down;
            rightArrows[y] = right;
            x_place += x_width;
         }
         y_place += y_height;
      }
      //invalidate();
   }

   private void RenderSimple(
      boolean down, boolean right)
   {
      //Paint paint = mPaint;
      mPaint.setColor(Color.BLACK);
      mPaint.setStrokeWidth(1);
      mPaint.setStyle(Paint.Style.FILL_AND_STROKE); // find example for fill
      x_width = scale;
      y_height = scale;
      int x_r = x_place + scale;
      int y_b = y_place + scale;
      if (down)
         g.drawRect((float)x_r, (float)y_place,(float)x_r, (float)y_b,mPaint);
      if (right)
         g.drawRect((float)x_place, (float)y_b, (float)x_r, y_b, mPaint);
   }

   // =====================================================
   private void RenderComplex(
      boolean down, int downPri, boolean right,
         int rightPri, boolean down_out, boolean right_out)
   {
      int width = downPri * 2;
      int height = rightPri * 2;
      x_width = scale * width;
      y_height = scale * height;
      for (int i = 0; i < maxPri; i++) {
         boolean work_done = true;
         if (i > maxPri - depth - 2) {
            work_done = false;
            mPaint.setColor(colorList[i]);
            mPaint.setStyle(Paint.Style.FILL); // find example for fill
            mPaint.setStrokeWidth(0);
            int w = width - 2 * i - 1;
            int h = height - 2 * i - 1;
            if (w > 0) 
            {
               if (down) 
               {
                  if (down_out) 
                  {
                     g.drawRect(
                        x_place + scale * (i+1),
                        y_place + 0,
                        x_place + scale * (i+1) + scale * w,
                        y_place + 0 + scale * (rightPri * 2), 
                        mPaint);
                     /*
                      * g.FillRectangle( b, x_place + scale * (i +  1), 
                      * y_place + 0, scale * w, scale * (rightPri * 2));
                      */
                  } else {
                     g.drawRect(
                        x_place + scale * (i+1), 
                        y_place + 0, 
                        x_place + scale * (i+1) + scale * w, 
                        y_place + 0 + scale * (rightPri+1),
                        mPaint);
                     /*
                      * g.FillRectangle( b, x_place + scale * (i + 1), 
                      * y_place + 0, scale * w, scale * (rightPri + 1));
                      */
                  }
               }
               if (down_out) {
                  g.drawRect( 
                     x_place + scale * (i + 1), 
                     y_place + scale * rightPri,
                     x_place + scale * (i + 1)+ scale * w, 
                     y_place + scale * rightPri + scale * rightPri,
                     mPaint);
          
                  /*
                   g.FillRectangle( b, x_place + scale * (i + 1), 
                   y_place + scale * rightPri,
                   scale * w, scale * rightPri);
                   */
               }
               work_done = true;
            }
            if (h > 0) 
            {
               if (right) 
               {
                  if (right_out) 
                  {
                     g.drawRect(
                        x_place + 0, 
                        y_place + scale * (i + 1), 
                        x_place + 0 + scale * (downPri * 2), 
                        y_place + scale * (i + 1)+scale * h, 
                        mPaint);
                     /*
                       drawRect( x_place + 0, 
                       y_place + scale * (i + 1), 
                       scale * (downPri * 2), scale * h);
                      */
                  }
                  {
                     g.drawRect( 
                        x_place + 0, 
                        y_place + scale * (i + 1), 
                        x_place + 0 + scale * (downPri + 1), 
                        y_place + scale * (i + 1)+ scale * h,
                        mPaint);
                     /*
                       g.FillRectangle( b, x_place + 0, 
                       y_place + scale * (i + 1), 
                       scale * (downPri + 1), scale * h);
                      */
                  }
               }
               if (right_out) {
                  g.drawRect(
                     x_place + scale * downPri,
                     y_place + scale * (i + 1), 
                     x_place + scale * downPri + scale * downPri, 
                     y_place + scale * (i + 1) + scale * h,
                     mPaint);
                  /*
                    g.FillRectangle( b, x_place + scale * downPri,
                    y_place + scale * (i + 1), scale * downPri, scale
                    * h);
                   */
               }
               work_done = true;
            }
         }
         if (!work_done)
            break;
      }
   }
   float x_was = 0;
   /*@Override public boolean onTouchEvent(MotionEvent event) 
   {
      if (event.getAction() == MotionEvent.ACTION_DOWN)
      {
         x_was = event.getX();
         return true;
      }
      if (event.getAction() == MotionEvent.ACTION_UP)
      {
         if (Math.abs(x_was-event.getX())<10)
         {
            depth++;
         }
         else if (event.getX()>x_was)
         {
            scale = scale + 1;
         }
         else if (event.getX()<x_was)
         {
            scale = scale - 1;
            if (scale == 0) scale = 1;
          
         }
         invalidate();
         return true;
         
      }
      return super.onTouchEvent(event);
      //Log.d(TAG, "onTouchEvent:")
      
   }*/
   private float mAnchorX=0;
   private float mAnchorY=0;
   private float mTouchStartX;
   private float mTouchStartY;
   private float mTouchCurrX;
   private float mTouchCurrY;
   @Override
   public boolean onTouchEvent(MotionEvent event) {
       float x = event.getX();
       float y = event.getY();
       
       switch (event.getAction()) {
           case MotionEvent.ACTION_DOWN:
               mTouchStartX = mTouchCurrX = x;
               mTouchStartY = mTouchCurrY = y;
               invalidate();
               break;
           case MotionEvent.ACTION_MOVE:
               mTouchCurrX = x;
               mTouchCurrY = y;
               invalidate();
               break;
           case MotionEvent.ACTION_UP:
               mAnchorX = mAnchorX + x - mTouchStartX;
               mAnchorY = mAnchorY + y - mTouchStartY;
               mTouchStartX = mTouchCurrX = x;
               mTouchStartY = mTouchCurrY = y;
               invalidate();
               break;
       }
       return true;
   }

}
